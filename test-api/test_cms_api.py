from typing import Dict, List, Optional, Tuple, Any
import os
import streamlit as st
from dotenv import load_dotenv
from pdf2image import convert_from_path
import tempfile
from pathlib import Path
import json
import requests
import base64
from openai import OpenAI
from PIL import Image

class PayloadCMSAPI:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.token = None
        self.headers = {
            'Content-Type': 'application/json'
        }

    def login(self, email: str, password: str) -> bool:
        """Login to get authentication token."""
        try:
            response = requests.post(
                f"{self.base_url}/api/users/login",
                json={
                    "email": email,
                    "password": password
                }
            )
            response.raise_for_status()
            data = response.json()
            
            # Get token from response
            self.token = data.get('token') or data.get('user', {}).get('token')
            if self.token:
                self.headers['Authorization'] = f'JWT {self.token}'
                st.success("✅ Login successful!")
                return True
            else:
                st.error("❌ No token received in response")
                return False
                
        except requests.exceptions.RequestException as e:
            st.error(f"❌ Login failed: {str(e)}")
            return False

    def upload_image(self, image_path: str) -> Optional[int]:
        """Upload an image and return its ID.
        
        Args:
            image_path (str): Path to the image file
            
        Returns:
            Optional[int]: ID of the uploaded image or None if upload fails
        """
        if not self.token:
            st.error("❌ Not authenticated. Please login first.")
            return None

        try:
            # Check if file exists
            if not os.path.exists(image_path):
                st.error(f"❌ Image file not found: {image_path}")
                return None

            # Get initial file size
            initial_size = os.path.getsize(image_path) / (1024 * 1024)  # Convert to MB
            st.info(f"📊 Initial image size: {initial_size:.2f}MB")

            # Open and optimize image before upload
            with Image.open(image_path) as img:
                # Log original image properties
                st.info(f"📊 Original image: Size={img.size}, Mode={img.mode}, Format={img.format}")
                
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                    st.info("🔄 Converted image to RGB mode")
                
                # Save optimized image to a temporary file
                with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
                    # Try different quality settings if needed
                    quality = 95  # Start with high quality
                    while True:
                        img.save(tmp_file.name, 'JPEG', quality=quality, optimize=True)
                        file_size = os.path.getsize(tmp_file.name) / (1024 * 1024)  # Convert to MB
                        
                        if file_size <= 5 or quality <= 60:  # Stop if file is small enough or quality is too low
                            break
                        
                        quality -= 5  # Reduce quality gradually
                        st.info(f"📉 Reducing image quality to {quality} (current size: {file_size:.2f}MB)")
                    
                    st.info(f"📊 Final image size: {file_size:.2f}MB, Quality: {quality}")
                    
                    try:
                        # Prepare the file for upload
                        filename = Path(image_path).name
                        
                        # Create proper multipart form data
                        files = {
                            'file': (
                                filename,
                                open(tmp_file.name, 'rb'),
                                'image/jpeg'
                            )
                        }
                        
                        # Set proper headers for multipart form data
                        upload_headers = {
                            'Authorization': f'JWT {self.token}'
                        }
                        
                        st.info("🚀 Attempting to upload image...")
                        response = requests.post(
                            f"{self.base_url}/api/media",
                            headers=upload_headers,
                            files=files,
                            timeout=30
                        )
                        
                        # Log the response status and headers
                        st.info(f"📡 Server response status: {response.status_code}")
                        
                        # Check for specific error cases
                        if response.status_code == 413:
                            st.error(f"❌ Image file is too large ({file_size:.2f}MB). Maximum size allowed is 5MB.")
                            return None
                        elif response.status_code == 415:
                            st.error("❌ Unsupported image format. Please use JPEG, PNG, or GIF.")
                            return None
                        elif response.status_code == 500:
                            st.error("❌ Server error while uploading.")
                            if response.text:
                                st.error(f"Server response: {response.text}")
                            return None
                        elif response.status_code == 401:
                            st.error("❌ Authentication failed. Please log in again.")
                            return None
                        
                        response.raise_for_status()
                        
                        data = response.json()
                        if data.get('doc', {}).get('id'):
                            st.success(f"✅ Image uploaded successfully! Size: {file_size:.2f}MB")
                            return data['doc']['id']
                        else:
                            st.error("❌ Upload succeeded but no document ID was returned")
                            st.error(f"Server response: {data}")
                            return None

                    except requests.exceptions.Timeout:
                        st.error("❌ Upload timed out. Please try again.")
                        return None
                    except requests.exceptions.RequestException as e:
                        st.error(f"❌ Image upload failed: {str(e)}")
                        if hasattr(e, 'response') and e.response is not None:
                            st.error(f"Server response: {e.response.text}")
                        return None
                    finally:
                        # Clean up the temporary file
                        try:
                            os.unlink(tmp_file.name)
                        except:
                            pass

        except Exception as e:
            st.error(f"❌ Failed to process image: {str(e)}")
            return None

    def create_module(self, title: str, description: str, image_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Create a new module."""
        if not self.token:
            st.error("❌ Not authenticated. Please login first.")
            return None

        try:
            payload = {
                "title": title,
                "description": description,
                "moduleThumbnail": image_id,
                "slides": [],  # Can be populated later
                "slidesColor": "#4287f5"  # Default color
            }

            response = requests.post(
                f"{self.base_url}/api/modules",
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            
            data = response.json()
            if data.get('doc', {}).get('id'):
                st.success(f"✅ Module created successfully!")
                return data['doc']
            else:
                st.error("❌ Module creation succeeded but no document was returned")
                return None

        except requests.exceptions.RequestException as e:
            st.error(f"❌ Module creation failed: {str(e)}")
            return None

    def delete_media(self, media_id: int) -> bool:
        """Delete a media item by its ID.
        
        Args:
            media_id (int): The ID of the media to delete
            
        Returns:
            bool: True if deletion was successful, False otherwise
        """
        if not self.token:
            st.error("❌ Not authenticated. Please login first.")
            return False

        try:
            response = requests.delete(
                f"{self.base_url}/api/media/{media_id}",
                headers=self.headers
            )
            
            if response.status_code in [200, 204]:
                st.success(f"✅ Successfully deleted media {media_id}")
                return True
            elif response.status_code == 404:
                st.warning(f"⚠️ Media {media_id} not found - may have been already deleted")
                return True
            else:
                st.error(f"❌ Failed to delete media {media_id}: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            st.error(f"❌ Error deleting media {media_id}: {str(e)}")
            return False

    def delete_slide(self, slide_id: int) -> bool:
        """Delete a slide and its associated image by ID.
        
        Args:
            slide_id (int): The ID of the slide to delete
            
        Returns:
            bool: True if deletion was successful, False otherwise
        """
        if not self.token:
            st.error("❌ Not authenticated. Please login first.")
            return False

        try:
            # First get the slide to get its image ID
            slide_response = requests.get(
                f"{self.base_url}/api/slides/{slide_id}",
                headers=self.headers
            )
            
            # If slide exists, get its image ID and delete the image
            if slide_response.status_code == 200:
                slide_data = slide_response.json()
                image_id = None
                
                # Handle different image reference formats
                if isinstance(slide_data.get('image'), dict):
                    image_id = slide_data['image'].get('id')
                elif isinstance(slide_data.get('image'), int):
                    image_id = slide_data['image']
                
                if image_id:
                    self.delete_media(image_id)

            # Now delete the slide
            response = requests.delete(
                f"{self.base_url}/api/slides/{slide_id}",
                headers=self.headers
            )
            
            if response.status_code in [200, 204]:
                st.success(f"✅ Successfully deleted slide {slide_id}")
                return True
            elif response.status_code == 404:
                st.warning(f"⚠️ Slide {slide_id} not found - may have been already deleted")
                return True
            else:
                st.error(f"❌ Failed to delete slide {slide_id}: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            st.error(f"❌ Error deleting slide {slide_id}: {str(e)}")
            return False

    def create_slide(self, 
                    title: str, 
                    description: str, 
                    slide_type: str = 'regular',
                    image_id: Optional[int] = None,
                    color_code: str = '#FF5733',
                    urls: Optional[list] = None,
                    module_id: Optional[str] = None,
                    order: int = 1,
                    add_to_module: bool = True) -> Optional[Dict[str, Any]]:
        """Create a new slide and optionally add it to a module.
        
        Args:
            title (str): Title of the slide
            description (str): Description/content of the slide
            slide_type (str, optional): Type of slide. Defaults to 'regular'
            image_id (Optional[int], optional): ID of the image to attach. Defaults to None
            color_code (str, optional): Color code for the slide. Defaults to '#FF5733'
            urls (Optional[list], optional): List of URLs. Defaults to None
            module_id (Optional[str], optional): ID of the module to add slide to. Defaults to None
            order (int, optional): Order of the slide in the module. Defaults to 1
            add_to_module (bool, optional): Whether to add the slide to the module. Defaults to True
            
        Returns:
            Optional[Dict[str, Any]]: Created slide data or None if creation fails
        """
        if not self.token:
            st.error("❌ Not authenticated. Please login first.")
            return None

        try:
            # Ensure proper slide type
            valid_types = {'regular', 'quiz', 'video', 'reference', 'resources'}
            normalized_type = slide_type.lower()
            if normalized_type not in valid_types:
                st.warning(f"⚠️ Invalid slide type '{slide_type}'. Using 'regular' instead.")
                normalized_type = 'regular'

            # Create the slide
            slide_payload = {
                "title": title,
                "description": description,
                "type": normalized_type,
                "image": image_id,
                "urls": urls or [],
                "order": order  # Add this if the API supports it
            }

            st.info("📝 Creating new slide...")
            response = requests.post(
                f"{self.base_url}/api/slides",
                headers=self.headers,
                json=slide_payload
            )
            
            response.raise_for_status()
            data = response.json()
            
            if not data.get('doc', {}).get('id'):
                st.error("❌ Slide creation response missing document ID")
                return None
                
            created_slide = data['doc']
            st.success(f"✅ Slide '{title}' created successfully!")

            # If module_id is provided and add_to_module is True, add slide to module
            if module_id and add_to_module:
                success = self.add_slide_to_module(module_id, created_slide)
                if not success:
                    st.warning("⚠️ Slide created but not added to module")
                    # Consider deleting the slide if module update fails
                    self.delete_slide(created_slide['id'])
                    return None
            
            return created_slide

        except requests.exceptions.RequestException as e:
            st.error(f"❌ Slide creation failed: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                st.error(f"Server response: {e.response.text}")
            return None

    def add_slide_to_module(self, module_id: str, slide: Dict[str, Any]) -> bool:
        """Add a single slide to a module.
        
        Args:
            module_id (str): ID of the module
            slide (Dict[str, Any]): Slide data to add
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Get current module data
            module_data = self.get_module_by_id(module_id)
            if not module_data:
                st.error(f"❌ Could not find module with ID {module_id}")
                return False

            # Get existing slides array or initialize empty
            existing_slides = module_data.get('slides', [])
            
            # Extract existing slide IDs
            existing_slide_ids = []
            for slide_item in existing_slides:
                if isinstance(slide_item, dict) and 'id' in slide_item:
                    existing_slide_ids.append(slide_item['id'])
                elif isinstance(slide_item, int) or isinstance(slide_item, str):
                    existing_slide_ids.append(slide_item)
            
            # Add new slide ID to array
            slide_id = slide['id']
            if slide_id not in existing_slide_ids:
                existing_slide_ids.append(slide_id)

            # Update module
            update_payload = {"slides": existing_slide_ids}
            
            update_response = requests.patch(
                f"{self.base_url}/api/modules/{module_id}",
                headers=self.headers,
                json=update_payload
            )
            
            if update_response.status_code in [200, 201]:
                st.success(f"✅ Slide added to module successfully!")
                return True
            else:
                st.error(f"❌ Failed to update module: {update_response.status_code}")
                st.error(f"Response: {update_response.text}")
                return False

        except requests.exceptions.RequestException as e:
            st.error(f"❌ Failed to add slide to module: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                st.error(f"Response: {e.response.text}")
            return False

    def add_slides_to_module(self, module_id: str, slide_ids: list[int]) -> Optional[Dict[str, Any]]:
        """
        Update a module's slides array with new slides, replacing any existing ones.
        
        Args:
            module_id (str): The ID of the module to update
            slide_ids (list[int]): List of slide IDs to add to the module
            
        Returns:
            Optional[Dict[str, Any]]: Updated module data or None if update fails
        """
        if not self.token:
            st.error("❌ Not authenticated. Please login first.")
            return None

        try:
            # Get current module data
            module_data = self.get_module_by_id(module_id)
            if not module_data:
                st.error(f"❌ Could not find module with ID {module_id}")
                return None

            # Delete existing slides if any
            if 'slides' in module_data and module_data['slides']:
                st.info("🗑️ Removing existing slides...")
                for slide in module_data['slides']:
                    slide_id = slide['id'] if isinstance(slide, dict) else slide
                    self.delete_slide(slide_id)

            # Get details for new slides
            st.info("📥 Fetching new slide details...")
            new_slides = []
            failed_slides = []
            
            for slide_id in slide_ids:
                try:
                    slide_response = requests.get(
                        f"{self.base_url}/api/slides/{slide_id}",
                        headers=self.headers
                    )
                    slide_response.raise_for_status()
                    
                    slide_data = slide_response.json()
                    if "doc" in slide_data:
                        slide_data = slide_data["doc"]
                    
                    new_slides.append(slide_id)
                except Exception as e:
                    failed_slides.append(slide_id)
                    st.error(f"❌ Failed to fetch slide {slide_id}: {str(e)}")

            if failed_slides:
                st.warning(f"⚠️ Failed to fetch {len(failed_slides)} slides: {failed_slides}")
                if not new_slides:
                    return None

            # Update module with new slides - use the correct format based on API requirements
            update_payload = {"slides": new_slides}
            
            st.info(f"🔄 Updating module with {len(new_slides)} slides...")
            
            update_response = requests.patch(
                f"{self.base_url}/api/modules/{module_id}",
                headers=self.headers,
                json=update_payload
            )
            
            if update_response.status_code in [200, 201]:
                st.success(f"✅ Successfully added {len(new_slides)} slides to module")
                if failed_slides:
                    st.warning(f"⚠️ Note: {len(failed_slides)} slides failed to be added")
                return update_response.json()
            else:
                st.error(f"❌ Failed to update module: {update_response.status_code}")
                st.error(f"Response: {update_response.text}")
                return None

        except requests.exceptions.RequestException as e:
            st.error(f"❌ Error updating module {module_id}: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                st.error(f"Response: {e.response.text}")
            return None

    def get_courses(self) -> List[Dict]:
        """Fetch all courses."""
        if not self.token:
            st.error("❌ Not authenticated. Please login first.")
            return []

        try:
            st.info("Fetching courses from API...")
            response = requests.get(
                f"{self.base_url}/api/courses",
                headers=self.headers
            )
            
            if response.status_code != 200:
                st.error(f"Failed to fetch courses: {response.status_code}")
                st.error(f"Response: {response.text}")
                return []
                
            response.raise_for_status()
            
            data = response.json()
            
            # Handle different response formats
            if "docs" in data:
                courses = data.get("docs", [])
            elif isinstance(data, list):
                courses = data
            else:
                st.error(f"Unexpected response format: {data}")
                return []
                
            st.success(f"Found {len(courses)} courses")
            
            # Extract course data
            result = []
            for course in courses:
                if isinstance(course, dict) and "id" in course and "title" in course:
                    result.append({
                        "id": course["id"],
                        "title": course["title"]
                    })
            
            return result

        except requests.exceptions.RequestException as e:
            st.error(f"❌ Failed to fetch courses: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                st.error(f"Response: {e.response.text}")
            return []

    def get_modules(self, course_id: Optional[str] = None) -> List[Dict]:
        """Fetch modules, optionally filtered by course.
        
        Args:
            course_id (Optional[str]): ID of the course to filter modules by
            
        Returns:
            List[Dict]: List of modules with their details
        """
        if not self.token:
            st.error("❌ Not authenticated. Please login first.")
            return []

        try:
            # First get the course details to get its connected modules
            if course_id:
                st.info(f"Fetching course details for ID: {course_id}")
                course_response = requests.get(
                    f"{self.base_url}/api/courses/{course_id}",
                    headers=self.headers,
                    params={"depth": 2}  # Increase depth to get module details
                )
                
                if course_response.status_code != 200:
                    st.error(f"Failed to fetch course: {course_response.status_code}")
                    st.error(f"Response: {course_response.text}")
                    return []
                    
                course_response.raise_for_status()
                course_data = course_response.json()
                
                # Check if we got a document or docs array
                if "doc" in course_data:
                    course_data = course_data["doc"]
                
                # Get the connected modules from the course data
                connected_modules = course_data.get("modules", [])
                st.info(f"Found {len(connected_modules)} connected modules")
                
                # Handle different response formats
                if len(connected_modules) > 0 and isinstance(connected_modules[0], int):
                    # We only got IDs, need to fetch each module
                    st.info("Fetching module details...")
                    processed_modules = []
                    for module_id in connected_modules:
                        try:
                            module_response = requests.get(
                                f"{self.base_url}/api/modules/{module_id}",
                                headers=self.headers
                            )
                            if module_response.status_code == 200:
                                module_data = module_response.json()
                                if "doc" in module_data:
                                    module_data = module_data["doc"]
                                processed_modules.append({
                                    "id": str(module_data["id"]),
                                    "title": module_data["title"],
                                    "slides_color": module_data.get("slidesColor"),
                                    "course": str(course_id),
                                    "slides": module_data.get("slides", [])
                                })
                        except Exception as e:
                            st.error(f"Error fetching module {module_id}: {str(e)}")
                    
                    return processed_modules
                else:
                    # Process the connected modules that came with depth=2
                    processed_modules = []
                    for module in connected_modules:
                        if isinstance(module, dict) and "id" in module:
                            processed_modules.append({
                                "id": str(module["id"]),
                                "title": module["title"],
                                "slides_color": module.get("slidesColor"),
                                "course": str(course_id),
                                "slides": module.get("slides", [])
                            })
                    
                    return processed_modules
            else:
                # If no course_id, get all modules
                response = requests.get(
                    f"{self.base_url}/api/modules",
                    headers=self.headers,
                    params={"depth": 1}
                )
                response.raise_for_status()
                data = response.json()
                modules = data.get("docs", [])
                
                return [{
                    "id": str(module["id"]),
                    "title": module["title"],
                    "slides_color": module.get("slidesColor"),
                    "course": None,
                    "slides": module.get("slides", [])
                } for module in modules]

        except requests.exceptions.RequestException as e:
            st.error(f"❌ Failed to fetch modules: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                st.error(f"Response: {e.response.text}")
            return []

    def get_slides(self, module_id: Optional[str] = None) -> List[Dict]:
        """Fetch slides, optionally filtered by module."""
        if not self.token:
            st.error("❌ Not authenticated. Please login first.")
            return []

        try:
            url = f"{self.base_url}/api/slides"
            query = {}
            
            if module_id:
                query["where"] = {
                    "module": {"equals": module_id}
                }

            response = requests.get(
                url,
                headers=self.headers,
                params={
                    "depth": 2,  # Increased depth to get full media objects
                    "where": json.dumps(query.get("where", {}))
                }
            )
            response.raise_for_status()
            
            data = response.json()
            slides = data.get("docs", [])
            
            return [{
                "id": slide["id"],
                "title": slide["title"],
                "description": slide.get("description", ""),
                "type": slide.get("type", "regular"),
                "image": self._get_media_url(slide.get("image")),  # Handle media URL resolution
                "module": slide.get("module", {}).get("id") if isinstance(slide.get("module"), dict) else None
            } for slide in slides]

        except requests.exceptions.RequestException as e:
            st.error(f"❌ Failed to fetch slides: {str(e)}")
            return []

    def _get_media_url(self, media_ref: Optional[Any]) -> Optional[str]:
        """Resolve media reference to URL based on Payload CMS structure."""
        if isinstance(media_ref, dict):
            # Handle populated media documents (when using depth=2)
            return f"{self.base_url}/media/{media_ref.get('filename')}"
        elif isinstance(media_ref, int):
            # Handle direct ID references
            return f"{self.base_url}/media/{media_ref}"
        return None

    def test_media_endpoint(self) -> bool:
        """Test if the media endpoint is accessible and working.
        
        Returns:
            bool: True if the endpoint is working, False otherwise
        """
        if not self.token:
            st.error("❌ Not authenticated. Please login first.")
            return False

        try:
            # Try to get the media endpoint
            response = requests.get(
                f"{self.base_url}/api/media",
                headers=self.headers,
                timeout=5
            )
            response.raise_for_status()
            return True
        except requests.exceptions.RequestException as e:
            st.error(f"❌ Media endpoint not accessible: {str(e)}")
            st.info("ℹ️ Please check if the Payload CMS server is running and accessible.")
            return False

    def get_module_by_id(self, module_id: str) -> Optional[Dict[str, Any]]:
        """Get a module by its ID.
        
        Args:
            module_id (str): ID of the module to fetch
            
        Returns:
            Optional[Dict[str, Any]]: Module data or None if not found
        """
        if not self.token:
            st.error("❌ Not authenticated. Please login first.")
            return None
            
        try:
            st.info(f"Fetching module with ID: {module_id}")
            response = requests.get(
                f"{self.base_url}/api/modules/{module_id}",
                headers=self.headers,
                params={"depth": 2}
            )
            
            if response.status_code != 200:
                st.error(f"Failed to fetch module: {response.status_code}")
                st.error(f"Response: {response.text}")
                return None
                
            data = response.json()
            
            # Handle different response formats
            if "doc" in data:
                return data["doc"]
            else:
                return data
                
        except requests.exceptions.RequestException as e:
            st.error(f"❌ Error fetching module {module_id}: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                st.error(f"Response: {e.response.text}")
            return None

# Load environment variables
load_dotenv()

# OpenAI Configuration
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Payload CMS Configuration
PAYLOAD_API_URL = os.getenv("PAYLOAD_API_URL", "http://localhost:3000")
PAYLOAD_EMAIL = os.getenv("PAYLOAD_EMAIL")
PAYLOAD_PASSWORD = os.getenv("PAYLOAD_PASSWORD")

# Initialize Payload CMS API client
payload_api = PayloadCMSAPI(PAYLOAD_API_URL)

# Validate required environment variables
def validate_env_vars():
    """Validate that all required environment variables are set."""
    required_vars = [
        "PAYLOAD_API_URL",
        "PAYLOAD_EMAIL",
        "PAYLOAD_PASSWORD",
        "OPENAI_API_KEY"
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

# Validate environment variables on startup
validate_env_vars()

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
            "title": "Error extracting slide information",
            "content": str(e),
            "type": "regular",
            "links": []
        }

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

def process_pdf(file_path: str, course_id: str, module_id: str, original_filename: str, module_title: str, course_title: str) -> List[str]:
    """Process PDF file and upload pages as images to Payload CMS.
    
    Args:
        file_path (str): Path to the PDF file
        course_id (str): ID of the course
        module_id (str): ID of the module
        original_filename (str): Original name of the uploaded PDF file
        module_title (str): Title of the module
        course_title (str): Title of the course
        
    Returns:
        List[str]: List of image URLs for the uploaded slides
    """
    # Test media endpoint before starting
    if not payload_api.test_media_endpoint():
        st.error("❌ Cannot proceed: Media endpoint is not accessible")
        return []
    
    # Login to Payload CMS
    if not payload_api.login(PAYLOAD_EMAIL, PAYLOAD_PASSWORD):
        st.error("Failed to authenticate with Payload CMS")
        return []
    
    urls = []
    slide_ids = []
    failed_pages = []
    
    # Get PDF filename without extension
    pdf_name = Path(original_filename).stem
    
    try:
        # First, get and delete existing slides from the module
        st.info("🔍 Checking for existing slides...")
        module_data = payload_api.get_module_by_id(module_id)
        if module_data and 'slides' in module_data and module_data['slides']:
            st.info("🗑️ Removing existing slides...")
            for slide in module_data['slides']:
                if isinstance(slide, dict) and 'id' in slide:
                    payload_api.delete_slide(slide['id'])
                elif isinstance(slide, int):
                    payload_api.delete_slide(slide)
            st.success("✅ Existing slides removed")

        # Convert PDF to images with status message
        with st.spinner('Converting PDF to images...'):
            # Use high DPI and specific dimensions for conversion
            images = convert_from_path(
                file_path,
                dpi=300,  # High DPI for quality
                fmt='jpeg',
                thread_count=4,
                use_cropbox=True,  # Use cropbox to maintain PDF dimensions
                size=(2250, 4000)  # Set exact dimensions for 9:16 ratio
            )
            total_pages = len(images)
            st.success(f"✅ Successfully converted PDF: {total_pages} pages found")
    except Exception as e:
        st.error(f"❌ Failed to convert PDF: {str(e)}")
        return []
    
    # Create progress tracking
    progress_container = st.container()
    progress_bar = st.progress(0)
    status_text = st.empty()
    metrics_col1, metrics_col2, metrics_col3 = st.columns(3)
    
    with metrics_col1:
        processed_counter = st.empty()
    with metrics_col2:
        success_counter = st.empty()
    with metrics_col3:
        failed_counter = st.empty()
        
    # Create a temporary directory for image processing
    with tempfile.TemporaryDirectory() as temp_dir:
        # Initialize counters
        processed = 0
        successful = 0
        failed = 0
        
        # Process images in batches for better performance
        batch_size = 5  # Process 5 images at a time
        for i in range(0, total_pages, batch_size):
            batch = images[i:i + batch_size]
            batch_paths = []
            
            # Save batch images
            for j, image in enumerate(batch, start=1):
                current_page = i + j
                filename = f"{pdf_name}_page_{current_page}.jpg"
                temp_path = os.path.join(temp_dir, filename)
                
                try:
                    # Save image with exact dimensions and high quality
                    image.save(
                        temp_path,
                        'JPEG',
                        quality=95,  # High quality
                        optimize=True,
                        dpi=(300, 300)  # Preserve DPI
                    )
                    batch_paths.append((current_page, temp_path))
                except Exception as e:
                    st.error(f"❌ Failed to save page {current_page}: {str(e)}")
                    failed_pages.append(current_page)
                    failed += 1
            
            # Process saved images
            for page_num, temp_path in batch_paths:
                try:
                    # Extract information from the slide
                    extracted_info = extract_slide_info(temp_path)
                    
                    # Clean up the content text
                    content_text = clean_content(extracted_info.get("content", ""))
                    
                    # Upload image to Payload CMS
                    image_id = payload_api.upload_image(temp_path)
                    if not image_id:
                        raise Exception("Failed to upload image to Payload CMS")
                    
                    # Create slide with enhanced title
                    slide_title = clean_content(extracted_info.get("title", f"Slide {page_num}"))
                    if not slide_title or slide_title == f"Slide {page_num}":
                        # Try to generate a more meaningful title from content
                        content_words = content_text.split()
                        if content_words:
                            slide_title = " ".join(content_words[:5]) + "..."
                    
                    slide = payload_api.create_slide(
                        title=slide_title,
                        description=content_text,
                        slide_type=str(extracted_info.get("type", "regular")).lower(),
                        image_id=image_id,
                        order=page_num,
                        module_id=None,  # Don't add to module yet
                        add_to_module=False  # Skip individual module updates
                    )
                    
                    if slide:
                        # Store the full URL including the base URL
                        image_url = slide.get("image", {}).get("url")
                        if image_url:
                            if not image_url.startswith(('http://', 'https://')):
                                image_url = f"{PAYLOAD_API_URL}{image_url}"
                            urls.append(image_url)
                        slide_ids.append(slide["id"])
                        successful += 1
                    else:
                        failed += 1
                        failed_pages.append(page_num)
                    
                except Exception as e:
                    st.error(f"❌ Failed to process page {page_num}: {str(e)}")
                    failed += 1
                    failed_pages.append(page_num)
                
                # Update progress
                processed += 1
                progress = int(processed * 100 / total_pages)
                progress_bar.progress(progress)
                status_text.text(f"Processing page {processed} of {total_pages}")
                
                # Update metrics
                processed_counter.metric("Processed", f"{processed}/{total_pages}")
                success_counter.metric("Successful", successful)
                failed_counter.metric("Failed", failed)
    
    # Clear progress tracking
    progress_bar.empty()
    status_text.empty()
    
    # Update module with new slides
    if slide_ids:
        st.info(f"🔄 Updating module with {len(slide_ids)} slide IDs: {slide_ids}")
        result = payload_api.add_slides_to_module(module_id, slide_ids)
        if result:
            st.success(f"✅ Successfully added {len(slide_ids)} slides to module")
            
            # Verify the update by fetching the module again
            updated_module = payload_api.get_module_by_id(module_id)
            if updated_module and 'slides' in updated_module:
                module_slides = updated_module['slides']
                st.info(f"📊 Module now has {len(module_slides)} slides")
                
                # Check if all slide IDs were added
                added_ids = []
                for slide in module_slides:
                    if isinstance(slide, dict) and 'id' in slide:
                        added_ids.append(slide['id'])
                    elif isinstance(slide, int) or isinstance(slide, str):
                        added_ids.append(slide)
                
                missing_ids = [str(sid) for sid in slide_ids if str(sid) not in [str(aid) for aid in added_ids]]
                if missing_ids:
                    st.warning(f"⚠️ Some slides were not added to the module: {missing_ids}")
        else:
            st.warning("⚠️ Failed to update module with new slides")
    
    # Final summary
    if failed_pages:
        st.warning(f"⚠️ Failed to process {len(failed_pages)} pages: {', '.join(map(str, failed_pages))}")
    
    if successful > 0:
        st.success(f"✅ Successfully processed {successful} out of {total_pages} pages")
    
    return urls

def main() -> None:
    """Main function to run the Streamlit app."""
    st.set_page_config(page_title="PDF to Slides Converter", layout="wide")
    
    # Add custom CSS
    st.markdown("""
        <style>
        .stProgress > div > div > div > div {
            background-color: #1f77b4;
        }
        .success-message {
            padding: 1rem;
            border-radius: 0.5rem;
            background-color: #d4edda;
            color: #155724;
            margin: 1rem 0;
        }
        .warning-message {
            padding: 1rem;
            border-radius: 0.5rem;
            background-color: #fff3cd;
            color: #856404;
            margin: 1rem 0;
        }
        </style>
    """, unsafe_allow_html=True)
    
    # App header
    st.title("📚 PDF to Slides Converter")
    st.markdown("Convert your PDF presentations into interactive course slides")
    
    # Create two columns for the main layout
    left_col, right_col = st.columns([2, 1])
    
    with left_col:
        # Main content area
        main_container = st.container()
        
        with main_container:
            # Login to Payload CMS
            if not payload_api.login(PAYLOAD_EMAIL, PAYLOAD_PASSWORD):
                st.error("❌ Failed to connect to Payload CMS")
                st.error(f"API URL: {PAYLOAD_API_URL}")
                st.error(f"Email: {PAYLOAD_EMAIL}")
                # Don't display password for security
                return
            
            # Test API connection
            if not payload_api.test_media_endpoint():
                st.error("❌ Cannot connect to Payload CMS API. Please check if the server is running.")
                return
                
            # Fetch courses from Payload CMS
            st.info("🔍 Fetching courses...")
            courses = payload_api.get_courses()
            if not courses:
                st.error("❌ No courses found. Please check your Payload CMS connection.")
                return
            
            # Course selection section
            st.subheader("1. Select Course")
            course_options = {str(course["id"]): course["title"] for course in courses}
            selected_course = st.selectbox(
                "Choose a course",
                options=list(course_options.keys()),
                format_func=lambda x: course_options[x],
                key="course_selector"
            )
            
            if selected_course:
                # Fetch and display modules
                st.info(f"🔍 Fetching modules for course: {course_options[selected_course]}...")
                st.subheader("2. Select Module")
                modules = payload_api.get_modules(selected_course)
                
                if not modules:
                    st.info(f"ℹ️ No modules found for course: {course_options[selected_course]}")
                    return
                
                # Module selection
                module_options = {str(module["id"]): module["title"] for module in modules}
                if module_options:
                    st.success(f"📚 Found {len(module_options)} modules for {course_options[selected_course]}")
                    
                    selected_module = st.selectbox(
                        "Choose a module",
                        options=list(module_options.keys()),
                        format_func=lambda x: module_options[x],
                        key="module_selector"
                    )
                    
                    if selected_module:
                        # Get slides for selected module
                        slides = payload_api.get_slides(selected_module)
                        
                        # Display current selection summary
                        st.markdown("""
                            <div class="success-message">
                                <h3>Current Selection:</h3>
                                <p>Course: {}</p>
                                <p>Module: {}</p>
                                <p>Existing Slides: {}</p>
                            </div>
                        """.format(
                            course_options[selected_course],
                            module_options[selected_module],
                            len(slides)
                        ), unsafe_allow_html=True)
                        
                        # PDF upload section
                        st.subheader("3. Upload PDF")
                        uploaded_file = st.file_uploader(
                            "Choose a PDF file",
                            type="pdf",
                            help="Upload a PDF file to convert into slides"
                        )
                        
                        if uploaded_file:
                            # File details
                            file_details = {
                                "Filename": uploaded_file.name,
                                "File size": f"{uploaded_file.size / 1024:.2f} KB"
                            }
                            
                            st.json(file_details)
                            
                            # Process button
                            if st.button("🚀 Process PDF", key="process_button"):
                                with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
                                    tmp_file.write(uploaded_file.getvalue())
                                    tmp_file_path = tmp_file.name
                                
                                try:
                                    with st.spinner('Processing PDF...'):
                                        urls = process_pdf(
                                            tmp_file_path,
                                            selected_course,
                                            selected_module,
                                            uploaded_file.name,
                                            module_options[selected_module],
                                            course_options[selected_course]
                                        )
                                        
                                        if urls:
                                            st.balloons()
                                            
                                            # Preview section
                                            st.subheader("🖼️ Preview of New Slides")
                                            for url in urls[:3]:  # Show first 3 pages
                                                try:
                                                    # Download the image and convert to base64
                                                    response = requests.get(url)
                                                    response.raise_for_status()
                                                    image_data = base64.b64encode(response.content).decode()
                                                    st.markdown(f'<img src="data:image/jpeg;base64,{image_data}" style="max-width: 100%; height: auto;">', unsafe_allow_html=True)
                                                except Exception as e:
                                                    st.error(f"Failed to load preview image: {str(e)}")
                                                
                                            if len(urls) > 3:
                                                st.info(f"ℹ️ Showing first 3 of {len(urls)} slides")
                                        else:
                                            st.warning("⚠️ No slides were created. Please check the logs for errors.")
                                            
                                finally:
                                    # Clean up temporary file
                                    os.unlink(tmp_file_path)
                else:
                    st.warning("⚠️ No modules available for selection.")
    
    with right_col:
        # Sidebar content
        with st.expander("ℹ️ How to Use", expanded=True):
            st.markdown("""
                ### Instructions
                1. **Select a Course** from the dropdown menu
                2. **Choose a Module** where you want to add slides
                3. **Upload your PDF** file
                4. Click **Process PDF** to start the conversion
                
                ### Features
                - Automatic slide title extraction
                - Content analysis and formatting
                - Progress tracking
                - Preview of created slides
                
                ### Tips
                - Make sure your PDF is properly formatted
                - Each page will become a separate slide
                - The process may take a few minutes for large files
            """)
        
        # Display current session stats
        with st.expander("📊 Session Statistics", expanded=True):
            st.markdown("### Current Session")
            if 'courses' in locals():
                st.metric("Courses Available", len(courses))
            if 'selected_course' in locals() and selected_course and 'modules' in locals():
                st.metric("Modules in Selected Course", len(modules))
            if 'selected_module' in locals() and selected_module and 'slides' in locals():
                st.metric("Existing Slides", len(slides))
            
        # Debug information
        with st.expander("🔧 Debug Information", expanded=False):
            st.markdown("### API Configuration")
            st.code(f"API URL: {PAYLOAD_API_URL}")
            st.markdown("### Authentication Status")
            st.code(f"Authenticated: {'Yes' if payload_api.token else 'No'}")
            if payload_api.token:
                # Show first 10 chars of token
                token_preview = payload_api.token[:10] + "..." if payload_api.token else "None"
                st.code(f"Token: {token_preview}")
            
            # Add API test button
            if st.button("🔄 Test API Connection"):
                with st.spinner("Testing API connection..."):
                    if payload_api.test_media_endpoint():
                        st.success("✅ API connection successful")
                    else:
                        st.error("❌ API connection failed")
            
            # Add module structure viewer
            if 'selected_module' in locals() and selected_module:
                st.markdown("### Selected Module Structure")
                module_data = payload_api.get_module_by_id(selected_module)
                if module_data:
                    st.json({
                        "id": module_data.get("id"),
                        "title": module_data.get("title"),
                        "slides_count": len(module_data.get("slides", [])),
                        "slides_format": "Objects" if module_data.get("slides") and isinstance(module_data.get("slides")[0], dict) else "IDs"
                    })

if __name__ == "__main__":
    main()
