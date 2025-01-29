from typing import Dict, List, Optional, Tuple
import os
import streamlit as st
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import boto3
from pdf2image import convert_from_path
import tempfile
from pathlib import Path
import uuid
import json
import requests
import base64
from io import BytesIO
from openai import OpenAI
from PIL import Image

# Load environment variables
load_dotenv()

# S3 Configuration
S3_BUCKET = "rsfilesdata"
AWS_ACCESS_KEY = "AKIAUGLYLUJBDKEQ7VTW"
AWS_SECRET_KEY = "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"
AWS_REGION = "us-east-1"

# Webhook Configuration
WEBHOOK_URL = "https://sciwell.app.n8n.cloud/webhook-test/fe0534c3-345f-421f-b348-90040db83af3"

# OpenAI Configuration
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def init_connection() -> psycopg2.extensions.connection:
    """Initialize database connection.
    
    Returns:
        psycopg2.extensions.connection: Database connection object
    """
    load_dotenv()
    
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=os.getenv("DB_PORT"),
        cursor_factory=RealDictCursor
    )

def get_courses() -> List[Dict]:
    """Fetch all courses from the database.
    
    Returns:
        List[Dict]: List of courses with their id and title
    """
    conn = init_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT id, title FROM courses ORDER BY title")
        courses = cur.fetchall()
    conn.close()
    return courses

def get_modules(course_id: Optional[int] = None) -> List[Dict]:
    """Fetch modules from the database, optionally filtered by course.
    
    Args:
        course_id (Optional[int]): Course ID to filter modules by
        
    Returns:
        List[Dict]: List of modules with their id and title
    """
    conn = init_connection()
    with conn.cursor() as cur:
        if course_id:
            cur.execute("""
                SELECT DISTINCT m.id, m.title 
                FROM modules m
                JOIN courses_rels cr ON cr.modules_id = m.id
                WHERE cr.parent_id = %s
                ORDER BY m.title
            """, (course_id,))
        else:
            cur.execute("SELECT id, title FROM modules ORDER BY title")
        modules = cur.fetchall()
    conn.close()
    return modules

def init_s3_client():
    """Initialize S3 client.
    
    Returns:
        boto3.client: Initialized S3 client
    """
    return boto3.client(
        's3',
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
        region_name=AWS_REGION
    )

def extract_slide_info(image_path: str) -> Dict:
    """Extract information from slide image using OpenAI Vision.
    
    Args:
        image_path (str): Path to the image file
        
    Returns:
        Dict: Extracted slide information
    """
    # Read image and convert to base64
    with open(image_path, "rb") as image_file:
        image_data = base64.b64encode(image_file.read()).decode('utf-8')
    
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "text",
                            "text": """Extract information from a slide image and format it as a structured JSON object.
                            Please ensure the content field contains all visible text from the slide.
                            If there are bullet points, include them with proper formatting.
                            
                            Required format:
                            {
                                "title": "The main title or heading of the slide",
                                "content": "All visible text content from the slide, including bullet points and paragraphs",
                                "type": "regular",
                                "links": []
                            }
                            """
                        }
                    ]
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_data}"
                            }
                        }
                    ]
                }
            ],
            response_format={"type": "json_object"},
            temperature=0,  # Lower temperature for more consistent output
            max_completion_tokens=2048
        )
        
        # Parse the response
        extracted_info = json.loads(response.choices[0].message.content)
        
        # Debug log
        st.write(f"Extracted content: {extracted_info.get('content', '')}")
        
        # Ensure content exists and is not empty
        if not extracted_info.get('content'):
            # If no content, try to use title as content
            extracted_info['content'] = extracted_info.get('title', '')
        
        return extracted_info
    except Exception as e:
        st.error(f"Failed to extract slide information: {str(e)}")
        return {
            "id": str(uuid.uuid4()),
            "title": "Error extracting slide information",
            "content": str(e),
            "type": "regular",
            "links": []
        }

def send_to_webhook(url: str, page_number: int, pdf_name: str, module_id: int, course_id: int, module_title: str, course_title: str, image_filename: str, extracted_info: Dict) -> None:
    """Send image URL and metadata to webhook.
    
    Args:
        url (str): S3 URL of the image
        page_number (int): Page number in the PDF
        pdf_name (str): Name of the PDF file
        module_id (int): ID of the module
        course_id (int): ID of the course
        module_title (str): Title of the module
        course_title (str): Title of the course
        image_filename (str): Name of the image file
        extracted_info (Dict): Information extracted from the slide
    """
    payload = {
        "url": url,
        "page_number": page_number,
        "pdf_name": pdf_name,
        "module": {
            "id": module_id,
            "title": module_title
        },
        "course": {
            "id": course_id,
            "title": course_title
        },
        "image_url": url,
        "slide_title": extracted_info.get("title", f"Slide {page_number}"),
        "image_filename": image_filename,
        "s3_path": f"{pdf_name}/{image_filename}",
        "extracted_info": extracted_info
    }
    
    try:
        response = requests.post(WEBHOOK_URL, json=payload)
        response.raise_for_status()
        st.write(f"✅ Sent page {page_number} to webhook")
    except requests.exceptions.RequestException as e:
        st.error(f"Failed to send page {page_number} to webhook: {str(e)}")

def get_image_metadata(image_path: str) -> Dict:
    """Get image metadata including dimensions and filesize.
    
    Args:
        image_path (str): Path to the image file
        
    Returns:
        Dict: Image metadata
    """
    with Image.open(image_path) as img:
        width, height = img.size
        
    filesize = os.path.getsize(image_path)
    
    return {
        "width": width,
        "height": height,
        "filesize": filesize,
        "focal_x": 50,  # Default focal point
        "focal_y": 50
    }

def create_thumbnail(image_path: str, output_dir: str, filename: str) -> Dict:
    """Create thumbnail versions of the image.
    
    Args:
        image_path (str): Path to the original image
        output_dir (str): Directory to save thumbnails
        filename (str): Original filename
        
    Returns:
        Dict: Thumbnail metadata
    """
    # Generate base filename without extension
    if '_page_' in filename:
        parts = filename.split('_page_')
        page_num = parts[1].split('_')[0]  # Get just the page number
        base_filename = f"{parts[0]}_page_{page_num}"
    else:
        base_filename = os.path.splitext(filename)[0]
    
    thumbnails = {
        "thumbnail": {"width": 400, "height": 300},  # Fixed dimensions
        "card": {"width": 768, "height": 1024}  # Fixed dimensions
    }
    
    result = {}
    ext = '.jpg'
    
    with Image.open(image_path) as img:
        for thumb_type, dimensions in thumbnails.items():
            # Create a copy of the image for resizing
            thumb = img.copy()
            
            # Resize image to exact dimensions
            thumb = thumb.resize(
                (dimensions["width"], dimensions["height"]), 
                Image.Resampling.LANCZOS
            )
            
            # Generate thumbnail filename with (1) suffix
            thumb_filename = f"{base_filename} (1)-{thumb_type}{ext}"
            thumb_path = os.path.join(output_dir, thumb_filename)
            
            # Save thumbnail
            thumb.save(thumb_path, "JPEG", quality=85)
            
            # Get thumbnail filesize
            thumb_size = os.path.getsize(thumb_path)
            
            # Store metadata
            result[thumb_type] = {
                "width": dimensions["width"],
                "height": dimensions["height"],
                "filename": thumb_filename,
                "filesize": thumb_size,
                "mime_type": "image/jpeg"
            }
    
    return result

def store_media(url: str, filename: str, pdf_name: str, image_path: str, mime_type: str = 'image/jpeg') -> int:
    """Store media information in the database.
    
    Args:
        url (str): S3 URL of the media
        filename (str): Name of the media file
        pdf_name (str): Name of the PDF file (without extension)
        image_path (str): Path to the temporary image file
        mime_type (str): MIME type of the media
        
    Returns:
        int: ID of the created media record
    """
    conn = init_connection()
    try:
        with conn.cursor() as cur:
            # Generate new filename without UUID
            if '_page_' in filename:
                parts = filename.split('_page_')
                page_num = parts[1].split('_')[0]  # Get just the page number
                new_filename = f"{parts[0]}_page_{page_num} (1).jpg"
            else:
                name = os.path.splitext(filename)[0]
                new_filename = f"{name} (1).jpg"
            
            # Try to find existing media with the same filename
            cur.execute("""
                SELECT id FROM media 
                WHERE filename = %s
            """, (new_filename,))
            existing = cur.fetchone()
            
            if existing:
                return existing["id"]
            
            # Get image metadata
            metadata = get_image_metadata(image_path)
            
            # Create thumbnails in temporary directory
            with tempfile.TemporaryDirectory() as temp_dir:
                thumbnails = create_thumbnail(image_path, temp_dir, filename)
                
                # Insert with new filename and metadata
                cur.execute("""
                    INSERT INTO media (
                        url, filename, mime_type, filesize, width, height,
                        focal_x, focal_y, sizes_thumbnail_width, sizes_thumbnail_height,
                        sizes_thumbnail_mime_type, sizes_thumbnail_filesize,
                        sizes_thumbnail_filename, sizes_card_width, sizes_card_height,
                        sizes_card_mime_type, sizes_card_filesize, sizes_card_filename,
                        created_at, updated_at, prefix
                    )
                    VALUES (
                        NULL, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s,
                        NOW(), NOW(), 'media'
                    )
                    RETURNING id
                """, (
                    new_filename, mime_type,
                    str(metadata["filesize"]), str(metadata["width"]), str(metadata["height"]),
                    str(metadata["focal_x"]), str(metadata["focal_y"]),
                    str(thumbnails["thumbnail"]["width"]), str(thumbnails["thumbnail"]["height"]),
                    thumbnails["thumbnail"]["mime_type"], str(thumbnails["thumbnail"]["filesize"]),
                    thumbnails["thumbnail"]["filename"],
                    str(thumbnails["card"]["width"]), str(thumbnails["card"]["height"]),
                    thumbnails["card"]["mime_type"], str(thumbnails["card"]["filesize"]),
                    thumbnails["card"]["filename"]
                ))
                
                media_id = cur.fetchone()["id"]
                conn.commit()
                return media_id
    finally:
        conn.close()

def store_slide(title: str, content: str, media_id: int, image_url: str, slide_type: str = 'regular') -> int:
    """Store slide information in the database.
    
    Args:
        title (str): Title of the slide
        content (str): Text content of the slide
        media_id (int): ID of the associated media
        image_url (str): URL of the slide image
        slide_type (str): Type of the slide (regular, quiz, video, reference, resources)
        
    Returns:
        int: ID of the created slide record
    """
    # Ensure slide_type matches the enum values
    valid_types = {'regular', 'quiz', 'video', 'reference', 'resources'}
    normalized_type = slide_type.lower()
    if normalized_type not in valid_types:
        normalized_type = 'regular'
    
    conn = init_connection()
    try:
        with conn.cursor() as cur:
            # First insert the slide
            cur.execute("""
                INSERT INTO slides (title, content, image_id, type, created_at, updated_at, slide_image)
                VALUES (%s, %s, %s, %s, NOW(), NOW(), %s)
                RETURNING id
            """, (title, content, media_id, normalized_type, image_url))
            slide_id = cur.fetchone()["id"]
            conn.commit()
            return slide_id
    finally:
        conn.close()

def create_module_slide_relation(module_id: int, slide_id: int, order: int) -> None:
    """Create relation between module and slide.
    
    Args:
        module_id (int): ID of the module
        slide_id (int): ID of the slide
        order (int): Order of the slide in the module
    """
    conn = init_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO modules_rels (parent_id, slides_id, "order", path)
                VALUES (%s, %s, %s, 'slides')
            """, (module_id, slide_id, order))
            conn.commit()
    finally:
        conn.close()

def delete_existing_slides(module_id: int, pdf_name: str) -> None:
    """Delete existing slides for a module with the given PDF name.
    
    Args:
        module_id (int): ID of the module
        pdf_name (str): Name of the PDF file (without extension)
    """
    conn = init_connection()
    try:
        with conn.cursor() as cur:
            # First get all slides IDs for this module that match the PDF name pattern
            cur.execute("""
                SELECT s.id, m.id as media_id
                FROM slides s
                JOIN modules_rels mr ON mr.slides_id = s.id
                LEFT JOIN media m ON m.id = s.image_id
                WHERE mr.parent_id = %s 
                AND m.filename LIKE %s
            """, (module_id, f"{pdf_name}_page_%"))
            
            slides_to_delete = cur.fetchall()
            
            if slides_to_delete:
                # Delete module relations first (will cascade to slides)
                slide_ids = [slide["id"] for slide in slides_to_delete]
                media_ids = [slide["media_id"] for slide in slides_to_delete if slide["media_id"]]
                
                # Delete module relations
                cur.execute("""
                    DELETE FROM modules_rels 
                    WHERE parent_id = %s AND slides_id = ANY(%s)
                """, (module_id, slide_ids))
                
                # Delete slides
                cur.execute("DELETE FROM slides WHERE id = ANY(%s)", (slide_ids,))
                
                # Delete media
                if media_ids:
                    cur.execute("DELETE FROM media WHERE id = ANY(%s)", (media_ids,))
                
                conn.commit()
                st.info(f"Removed {len(slides_to_delete)} existing slides for this PDF")
    finally:
        conn.close()

def clean_content(content: any) -> str:
    """Clean and format content to ensure it's a string.
    
    Args:
        content: Content to clean, can be string, dict, or any other type
        
    Returns:
        str: Cleaned content as a string
    """
    try:
        # If it's already a string, just clean it
        if isinstance(content, str):
            # Remove quotes and brackets
            cleaned = content.strip('{}[]"\'')
            # Remove text markers
            cleaned = cleaned.replace("'text': ", "").replace('"text": ', "")
            # Remove type markers
            cleaned = cleaned.replace("'type': ", "").replace('"type": ', "")
            # Remove resource markers
            cleaned = cleaned.replace("'resource'", "").replace('"resource"', "")
            # Clean up multiple spaces and newlines
            cleaned = ' '.join(cleaned.split())
            return cleaned
            
        # If it's a dictionary
        if isinstance(content, dict):
            # Try to get the text content directly
            if "text" in content:
                return clean_content(content["text"])
            # Or try content field
            if "content" in content:
                return clean_content(content["content"])
            # Convert dict to string and clean
            return clean_content(str(content))
            
        # If it's a list, join the items
        if isinstance(content, list):
            # Clean each item and join
            cleaned_items = [clean_content(item) for item in content if item]
            return " ".join(cleaned_items)
            
        # For any other type, convert to string and clean
        return clean_content(str(content))
    except Exception as e:
        st.error(f"Error cleaning content: {str(e)}")
        return ""

def process_pdf(file_path: str, course_id: int, module_id: int, original_filename: str, module_title: str, course_title: str) -> List[str]:
    """Process PDF file and upload pages as images to S3.
    
    Args:
        file_path (str): Path to the PDF file
        course_id (int): ID of the course
        module_id (int): ID of the module
        original_filename (str): Original name of the uploaded PDF file
        module_title (str): Title of the module
        course_title (str): Title of the course
        
    Returns:
        List[str]: List of S3 URLs for the uploaded images
    """
    s3_client = init_s3_client()
    urls = []
    
    # Get PDF filename without extension
    pdf_name = Path(original_filename).stem
    
    # Delete existing slides for this PDF in this module
    delete_existing_slides(module_id, pdf_name)
    
    # Convert PDF to images
    images = convert_from_path(file_path)
    
    # Create progress bar
    progress_bar = st.progress(0)
    status_text = st.empty()
    
    # Create a temporary directory for image processing
    with tempfile.TemporaryDirectory() as temp_dir:
        total_pages = len(images)
        for i, image in enumerate(images, start=1):  # Start page numbering from 1
            # Update progress
            progress = int(i * 100 / total_pages)
            progress_bar.progress(progress)
            status_text.text(f"Processing page {i} of {total_pages}")
            
            # Generate filename using PDF name and page number
            filename = f"{pdf_name}_page_{i}.jpg"
            temp_path = os.path.join(temp_dir, filename)
            
            # Save image temporarily
            image.save(temp_path, 'JPEG')
            
            # Extract information from the slide
            extracted_info = extract_slide_info(temp_path)
            
            # Clean up the content text
            content_text = clean_content(extracted_info.get("content", ""))
            
            # Define S3 path with simpler structure
            s3_path = f"{pdf_name}/{filename}"
            
            # Upload to S3 without ACL
            s3_client.upload_file(
                temp_path,
                S3_BUCKET,
                s3_path,
                ExtraArgs={'ContentType': 'image/jpeg'}
            )
            
            # Generate URL using the bucket website endpoint
            url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_path}"
            urls.append(url)
            
            try:
                # Store media information with proper URL format and metadata
                media_id = store_media(url, filename, pdf_name, temp_path)
                
                # Store slide information with only the text content
                slide_id = store_slide(
                    title=clean_content(extracted_info.get("title", f"Slide {i}")),
                    content=content_text,
                    media_id=media_id,
                    image_url=url,
                    slide_type=str(extracted_info.get("type", "regular")).lower()
                )
                
                # Create module-slide relation
                create_module_slide_relation(module_id, slide_id, i)
                
                st.success(f"✅ Stored slide {i} in database")
            except Exception as e:
                st.error(f"Failed to store slide {i} in database: {str(e)}")
    
    # Clear progress bar and status text
    progress_bar.empty()
    status_text.empty()
    
    return urls

def main() -> None:
    """Main function to run the Streamlit app."""
    st.title("PDF to Slides Converter")
    
    # Fetch courses
    courses = get_courses()
    course_options = {str(course["id"]): course["title"] for course in courses}
    
    # Course dropdown
    selected_course = st.selectbox(
        "Select a Course",
        options=list(course_options.keys()),
        format_func=lambda x: course_options[x],
        key="course_selector"
    )
    
    if selected_course:
        # Fetch modules for selected course
        modules = get_modules(int(selected_course))
        module_options = {str(module["id"]): module["title"] for module in modules}
        
        # Module dropdown
        if module_options:
            selected_module = st.selectbox(
                "Select a Module",
                options=list(module_options.keys()),
                format_func=lambda x: module_options[x],
                key="module_selector"
            )
            
            if selected_module:
                st.success(f"Selected Course: {course_options[selected_course]}\nSelected Module: {module_options[selected_module]}")
                
                # PDF uploader
                uploaded_file = st.file_uploader("Upload PDF", type="pdf")
                if uploaded_file:
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
                        tmp_file.write(uploaded_file.getvalue())
                        tmp_file_path = tmp_file.name
                    
                    try:
                        with st.spinner('Processing PDF...'):
                            urls = process_pdf(
                                tmp_file_path,
                                int(selected_course),
                                int(selected_module),
                                uploaded_file.name,
                                module_options[selected_module],
                                course_options[selected_course]
                            )
                            st.success(f"Successfully processed {len(urls)} pages!")
                            
                            # Display preview of first few pages
                            st.subheader("Preview")
                            for url in urls[:3]:  # Show first 3 pages
                                st.image(url)
                    finally:
                        # Clean up temporary file
                        os.unlink(tmp_file_path)
        else:
            st.info("No modules found for this course")

if __name__ == "__main__":
    main()
