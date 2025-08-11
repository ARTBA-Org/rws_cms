from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
import base64
import io
import os
from typing import List, Dict, Any
import openai
from PIL import Image
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="PDF Processor Service", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client
openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run"""
    return {"status": "healthy", "service": "pdf-processor"}

@app.post("/convert-pdf")
async def convert_pdf_to_images(file: UploadFile = File(...)):
    """Convert PDF to images and return as base64 encoded strings"""
    try:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")
        
        # Read PDF content
        pdf_content = await file.read()
        logger.info(f"Processing PDF: {file.filename}, size: {len(pdf_content)} bytes")
        
        # Convert PDF to images using PyMuPDF
        images = []
        pdf_document = fitz.open(stream=pdf_content, filetype="pdf")
        
        for page_num in range(pdf_document.page_count):
            page = pdf_document[page_num]
            
            # Render page as image (300 DPI for good quality)
            mat = fitz.Matrix(300/72, 300/72)  # 300 DPI scaling
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to PIL Image
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            images.append({
                "page": page_num + 1,
                "image": img_base64,
                "format": "png"
            })
        
        pdf_document.close()
        logger.info(f"Successfully converted {len(images)} pages")
        
        return {
            "success": True,
            "page_count": len(images),
            "images": images
        }
        
    except Exception as e:
        logger.error(f"PDF conversion error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"PDF conversion failed: {str(e)}")

@app.post("/process-pdf-with-ai")
async def process_pdf_with_ai(file: UploadFile = File(...)):
    """Convert PDF to images and process with OpenAI Vision API"""
    try:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")
        
        if not os.getenv("OPENAI_API_KEY"):
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        
        # Read PDF content
        pdf_content = await file.read()
        logger.info(f"Processing PDF with AI: {file.filename}, size: {len(pdf_content)} bytes")
        
        # Convert PDF to images
        images = []
        pdf_document = fitz.open(stream=pdf_content, filetype="pdf")
        
        for page_num in range(pdf_document.page_count):
            page = pdf_document[page_num]
            
            # Render page as image (300 DPI)
            mat = fitz.Matrix(300/72, 300/72)
            pix = page.get_pixmap(matrix=mat)
            
            # Convert to base64 for OpenAI
            img_data = pix.tobytes("png")
            img_base64 = base64.b64encode(img_data).decode()
            
            images.append({
                "page": page_num + 1,
                "image": img_base64
            })
        
        pdf_document.close()
        
        # Process with OpenAI Vision API
        ai_results = []
        
        for img_data in images:
            try:
                response = openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": """Analyze this slide/page and extract:
1. Main title or heading
2. Key points or bullet points
3. Any important data, numbers, or statistics
4. Overall topic or theme
5. Any action items or conclusions

Format your response as JSON with these fields:
- title: string
- key_points: array of strings
- data_points: array of strings
- topic: string
- action_items: array of strings
- summary: string (brief summary of the slide)"""
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/png;base64,{img_data['image']}"
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens=1000
                )
                
                # Parse AI response
                ai_content = response.choices[0].message.content
                try:
                    ai_json = json.loads(ai_content)
                except json.JSONDecodeError:
                    # Fallback if AI doesn't return valid JSON
                    ai_json = {
                        "title": "Analysis Available",
                        "key_points": [],
                        "data_points": [],
                        "topic": "Content Analysis",
                        "action_items": [],
                        "summary": ai_content[:200] + "..." if len(ai_content) > 200 else ai_content
                    }
                
                ai_results.append({
                    "page": img_data["page"],
                    "analysis": ai_json
                })
                
            except Exception as ai_error:
                logger.error(f"AI processing error for page {img_data['page']}: {str(ai_error)}")
                ai_results.append({
                    "page": img_data["page"],
                    "analysis": {
                        "title": f"Page {img_data['page']}",
                        "key_points": [],
                        "data_points": [],
                        "topic": "Analysis Failed",
                        "action_items": [],
                        "summary": f"AI analysis failed: {str(ai_error)}"
                    }
                })
        
        logger.info(f"Successfully processed {len(ai_results)} pages with AI")
        
        return {
            "success": True,
            "page_count": len(images),
            "filename": file.filename,
            "results": ai_results
        }
        
    except Exception as e:
        logger.error(f"PDF AI processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"PDF AI processing failed: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint with service info"""
    return {
        "service": "PDF Processor Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "convert_pdf": "/convert-pdf",
            "process_pdf_with_ai": "/process-pdf-with-ai"
        }
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)