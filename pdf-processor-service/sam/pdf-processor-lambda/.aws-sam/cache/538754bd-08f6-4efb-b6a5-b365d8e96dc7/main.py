from fastapi import FastAPI, File, UploadFile, HTTPException, Body
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
import uuid
import boto3
from botocore.exceptions import ClientError

# Configure logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
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
s3_client = boto3.client("s3")
BUCKET_NAME = os.getenv("BUCKET_NAME")

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

@app.post("/presign-upload")
async def presign_upload(
    payload: Dict[str, Any] = Body(..., embed=True)
):
    """Generate a presigned URL to upload a PDF directly to S3.
    Request body: { filename: string, contentType?: string }
    """
    if not BUCKET_NAME:
        raise HTTPException(status_code=500, detail="BUCKET_NAME not configured")

    filename = payload.get("filename")
    content_type = payload.get("contentType", "application/pdf")
    if not filename or not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="filename must end with .pdf")

    key = f"uploads/{uuid.uuid4().hex}-{os.path.basename(filename)}"
    try:
        url = s3_client.generate_presigned_url(
            "put_object",
            Params={"Bucket": BUCKET_NAME, "Key": key, "ContentType": content_type},
            ExpiresIn=3600,
        )
        return {"success": True, "upload_url": url, "key": key, "bucket": BUCKET_NAME}
    except ClientError as e:
        logger.error(f"Presign error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate presigned URL")

@app.post("/convert-from-s3")
async def convert_from_s3(payload: Dict[str, Any] = Body(..., embed=True)):
    """Convert a PDF stored in S3 to images, upload images back to S3, and return presigned URLs.
    Request body: { key: string }
    """
    if not BUCKET_NAME:
        raise HTTPException(status_code=500, detail="BUCKET_NAME not configured")
    key = payload.get("key")
    if not key:
        raise HTTPException(status_code=400, detail="key is required")
    try:
        obj = s3_client.get_object(Bucket=BUCKET_NAME, Key=key)
        pdf_content = obj["Body"].read()
        logger.info(f"Processing S3 PDF: s3://{BUCKET_NAME}/{key}, size: {len(pdf_content)} bytes")

        # Prepare an output prefix to group images by job
        job_id = uuid.uuid4().hex
        output_prefix = f"outputs/{job_id}"

        image_urls: List[Dict[str, Any]] = []
        pdf_document = fitz.open(stream=pdf_content, filetype="pdf")
        for page_num in range(pdf_document.page_count):
            page = pdf_document[page_num]
            mat = fitz.Matrix(300/72, 300/72)
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("png")

            # Upload to S3
            out_key = f"{output_prefix}/page-{page_num+1}.png"
            s3_client.put_object(
                Bucket=BUCKET_NAME,
                Key=out_key,
                Body=img_bytes,
                ContentType="image/png",
            )
            # Generate presigned GET URL
            url = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": BUCKET_NAME, "Key": out_key},
                ExpiresIn=3600,
            )
            image_urls.append({"page": page_num + 1, "key": out_key, "url": url})
        pdf_document.close()
        return {"success": True, "page_count": len(image_urls), "output_prefix": output_prefix, "images": image_urls}
    except Exception as e:
        logger.error(f"S3 convert error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"S3 convert failed: {str(e)}")

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
                
                # Parse AI response with robust JSON extraction
                ai_content = response.choices[0].message.content
                def try_extract_json(text: str):
                    try:
                        return json.loads(text)
                    except Exception:
                        first = text.find('{')
                        last = text.rfind('}')
                        if first != -1 and last != -1 and last > first:
                            slice_txt = text[first:last+1]
                            try:
                                return json.loads(slice_txt)
                            except Exception:
                                return None
                        return None
                parsed = try_extract_json(ai_content)
                if parsed is None:
                    ai_json = {
                        "title": "",
                        "key_points": [],
                        "data_points": [],
                        "topic": "",
                        "action_items": [],
                        "summary": ai_content
                    }
                else:
                    ai_json = parsed
                
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

def _extract_json_with_diagnostics(text: str) -> Dict[str, Any]:
    """Try hard to extract a JSON object from model text; return diagnostics."""
    diags = {
        "had_fence": False,
        "direct_parse_ok": False,
        "fenced_parse_ok": False,
        "brace_slice_parse_ok": False,
        "error": None,
    }
    try:
        obj = json.loads(text)
        diags["direct_parse_ok"] = True
        return obj, diags
    except Exception as e:
        diags["error"] = str(e)
    # fenced block
    import re
    fence = re.search(r"```json[\s\S]*?```", text, flags=re.IGNORECASE) or re.search(r"```[\s\S]*?```", text)
    candidate = None
    if fence:
        diags["had_fence"] = True
        candidate = fence.group(0)
        candidate = re.sub(r"```json|```", "", candidate, flags=re.IGNORECASE).strip()
        try:
            obj = json.loads(candidate)
            diags["fenced_parse_ok"] = True
            return obj, diags
        except Exception as e:
            diags["error"] = str(e)
    # brace slice
    t = candidate if candidate is not None else text
    first = t.find("{")
    last = t.rfind("}")
    if first != -1 and last != -1 and last > first:
        slice_txt = t[first:last+1]
        # clean: trailing commas, smart quotes
        slice_txt = re.sub(r",\s*([}\]])", r"\1", slice_txt)
        slice_txt = slice_txt.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
        try:
            obj = json.loads(slice_txt)
            diags["brace_slice_parse_ok"] = True
            return obj, diags
        except Exception as e:
            diags["error"] = str(e)
    return None, diags


@app.post("/process-from-s3")
async def process_from_s3(payload: Dict[str, Any] = Body(..., embed=True)):
    """Process a PDF stored in S3 with OpenAI Vision.
    Request body: { key: string }
    """
    if not BUCKET_NAME:
        raise HTTPException(status_code=500, detail="BUCKET_NAME not configured")
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    key = payload.get("key")
    max_pages = int(payload.get("max_pages") or 0)  # 0 = all
    debug_flag = bool(payload.get("debug") or os.getenv("DEBUG_LOGS") == "1")
    if not key:
        raise HTTPException(status_code=400, detail="key is required")
    try:
        obj = s3_client.get_object(Bucket=BUCKET_NAME, Key=key)
        pdf_content = obj["Body"].read()
        logger.info(f"Processing S3 PDF with AI: s3://{BUCKET_NAME}/{key}, size: {len(pdf_content)} bytes, max_pages={max_pages or 'all'}, debug={debug_flag}")

        images = []
        pdf_document = fitz.open(stream=pdf_content, filetype="pdf")
        total = pdf_document.page_count
        pages_to_process = total if max_pages <= 0 else min(max_pages, total)
        for page_num in range(pages_to_process):
            page = pdf_document[page_num]
            mat = fitz.Matrix(300/72, 300/72)
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            img_base64 = base64.b64encode(img_data).decode()
            images.append({"page": page_num + 1, "image": img_base64})
            if debug_flag:
                logger.info(f"Prepared page {page_num+1}: raw_png_bytes={len(img_data)}, b64_len={len(img_base64)}")
        pdf_document.close()

        ai_results = []
        for img_data in images:
            try:
                response = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "Analyze this slide/page and extract main points and summary strictly as JSON with keys: title, key_points[], data_points[], topic, action_items[], summary."},
                                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_data['image']}"}},
                            ],
                        }
                    ],
                    max_tokens=1000,
                )
                ai_content = response.choices[0].message.content
                if debug_flag:
                    preview = ai_content[:240].replace("\n", " ")
                    logger.info(f"AI raw page {img_data['page']} content len={len(ai_content)} preview={preview}")
                parsed, diags = _extract_json_with_diagnostics(ai_content)
                if debug_flag:
                    logger.info(f"AI parse page {img_data['page']} diags={diags}")
                if parsed is None:
                    ai_json = {
                        "title": f"Page {img_data['page']}",
                        "key_points": [],
                        "data_points": [],
                        "topic": "Content Analysis",
                        "action_items": [],
                        "summary": ai_content[:200] + ("..." if len(ai_content) > 200 else ""),
                    }
                else:
                    ai_json = parsed
                ai_results.append({"page": img_data["page"], "analysis": ai_json})
            except Exception as ai_error:
                logger.error(f"AI processing error for page {img_data['page']}: {str(ai_error)}")
                ai_results.append({"page": img_data["page"], "analysis": {"title": f"Page {img_data['page']}", "key_points": [], "data_points": [], "topic": "Analysis Failed", "action_items": [], "summary": f"AI analysis failed: {str(ai_error)}"}})

        resp: Dict[str, Any] = {"success": True, "page_count": len(images), "filename": key, "results": ai_results}
        if debug_flag:
            # include lightweight diagnostics only
            resp["debug"] = {"pages": len(images)}
        return resp
    except Exception as e:
        logger.error(f"S3 AI processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"S3 AI processing failed: {str(e)}")

@app.get("/diagnostics/openai")
async def diagnostics_openai():
    try:
        # Simple, fast text-only check
        resp = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": "Say OK"}],
            max_tokens=5,
        )
        content = resp.choices[0].message.content
        return {"ok": True, "reply": content}
    except Exception as e:
        return {"ok": False, "error": str(e)}

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