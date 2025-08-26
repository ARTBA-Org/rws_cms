import io
import json
import os
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from .services.pdf import pdf_to_images
from .services.openai_extract import extract_details_from_images as openai_extract_details_from_images
from .services.claude_extract import extract_details_from_images as claude_extract_details_from_images
from .services.slugify import slugify
from .services.payload_client import create_payload_item, upload_image_to_payload, update_module_slides


load_dotenv()


class Settings(BaseModel):
    # AI Provider settings
    ai_provider: str = Field(default_factory=lambda: os.environ.get("AI_PROVIDER", "openai"))
    
    # Claude settings
    anthropic_api_key: str = Field(default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", ""))
    claude_model: str = Field(default_factory=lambda: os.environ.get("CLAUDE_MODEL", "claude-3-5-sonnet-20241022"))
    
    # OpenAI settings
    openai_api_key: str = Field(default_factory=lambda: os.environ.get("OPENAI_API_KEY", ""))
    openai_model: str = Field(default_factory=lambda: os.environ.get("OPENAI_MODEL", "gpt-4o-mini"))
    
    # Payload settings
    payload_base_url: str = Field(default_factory=lambda: os.environ.get("PAYLOAD_BASE_URL", ""))
    payload_api_token: str = Field(default_factory=lambda: os.environ.get("PAYLOAD_API_TOKEN", ""))
    payload_default_collection: Optional[str] = Field(default_factory=lambda: os.environ.get("PAYLOAD_DEFAULT_COLLECTION"))
    payload_email: Optional[str] = Field(default_factory=lambda: os.environ.get("PAYLOAD_EMAIL"))
    payload_password: Optional[str] = Field(default_factory=lambda: os.environ.get("PAYLOAD_PASSWORD"))
    payload_default_draft: Optional[bool] = Field(default_factory=lambda: (os.environ.get("PAYLOAD_DRAFT", "").lower() in ("1","true","yes")) if os.environ.get("PAYLOAD_DRAFT") is not None else None)
    payload_default_depth: Optional[int] = Field(default_factory=lambda: int(os.environ.get("PAYLOAD_DEPTH")) if os.environ.get("PAYLOAD_DEPTH") else None)
    payload_default_locale: Optional[str] = Field(default_factory=lambda: os.environ.get("PAYLOAD_LOCALE"))
    payload_auth_collection: str = Field(default_factory=lambda: os.environ.get("PAYLOAD_AUTH_COLLECTION", "users"))
    cors_origins: List[str] = Field(default_factory=lambda: [o for o in os.environ.get("CORS_ORIGINS", "").split(",") if o])


settings = Settings()

app = FastAPI(title="PDF Extractor API")

# CORS
if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/ingest")
async def ingest(
    file: UploadFile = File(...),
    collection: Optional[str] = Form(None),
    fields: Optional[str] = Form(None),  # JSON array (string)
    max_pages: int = Form(999),  # Process all pages by default
    create_in_payload: bool = Form(True),
    instruction: Optional[str] = Form(None),
    return_images: bool = Form(False),  # Return base64 images
    # Payload options (optional)
    payload_draft: Optional[bool] = Form(None),
    payload_depth: Optional[int] = Form(None),
    payload_locale: Optional[str] = Form(None),
    payload_email: Optional[str] = Form(None),
    payload_password: Optional[str] = Form(None),
):
    # Validate AI provider configuration
    if settings.ai_provider == "claude" and not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured for Claude")
    elif settings.ai_provider == "openai" and not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured for OpenAI")
    elif settings.ai_provider not in ["claude", "openai"]:
        raise HTTPException(status_code=500, detail="AI_PROVIDER must be 'claude' or 'openai'")

    if create_in_payload and not (collection or settings.payload_default_collection):
        raise HTTPException(status_code=400, detail="'collection' not provided and PAYLOAD_DEFAULT_COLLECTION not configured")

    try:
        pdf_bytes = await file.read()
        if not pdf_bytes:
            raise ValueError("Empty file")

        images_png = pdf_to_images(pdf_bytes, max_pages=max_pages)
        if not images_png:
            raise ValueError("No pages rendered from PDF")

        fields_list: Optional[List[str]] = None
        if fields:
            try:
                parsed = json.loads(fields)
                if isinstance(parsed, list) and all(isinstance(x, str) for x in parsed):
                    fields_list = parsed
                else:
                    raise ValueError
            except Exception:
                raise HTTPException(status_code=400, detail="'fields' must be a JSON array of strings")
        else:
            # Sensible defaults
            fields_list = ["title", "date", "total", "vendor", "items"]

        # Use appropriate AI service based on provider
        if settings.ai_provider == "claude":
            extracted = await claude_extract_details_from_images(
                png_images=images_png,
                api_key=settings.anthropic_api_key,
                model=settings.claude_model,
                fields=fields_list,
                instruction=instruction,
            )
        else:  # openai
            extracted = await openai_extract_details_from_images(
                png_images=images_png,
                api_key=settings.openai_api_key,
                model=settings.openai_model,
                fields=fields_list,
                instruction=instruction,
            )

        payload_resp = None
        if create_in_payload:
            target_collection = collection or settings.payload_default_collection
            if not settings.payload_base_url:
                raise HTTPException(status_code=500, detail="PAYLOAD_BASE_URL not configured")

            # Auth precedence: explicit email/password form -> env email/password -> API token
            auth_email = payload_email or settings.payload_email
            auth_password = payload_password or settings.payload_password
            api_token = settings.payload_api_token or None

            if not (api_token or (auth_email and auth_password)):
                raise HTTPException(status_code=500, detail="Provide PAYLOAD_API_TOKEN or PAYLOAD_EMAIL/PAYLOAD_PASSWORD (or pass via form)")

            payload_resp = await create_payload_item(
                base_url=settings.payload_base_url,
                collection=target_collection,
                data=extracted,
                api_token=api_token,
                email=auth_email,
                password=auth_password,
                auth_collection=settings.payload_auth_collection,
                draft=(payload_draft if payload_draft is not None else settings.payload_default_draft),
                depth=(payload_depth if payload_depth is not None else settings.payload_default_depth),
                locale=(payload_locale if payload_locale else settings.payload_default_locale),
            )

        result = {
            "pages_processed": len(images_png),
            "extracted": extracted,
            "payload_response": payload_resp,
        }
        
        # Include base64 images if requested
        if return_images:
            import base64
            result["page_images"] = [
                base64.b64encode(img).decode('utf-8') for img in images_png
            ]
        
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/slides/ingest")
async def ingest_slides(
    file: UploadFile = File(...),
    module_id: int = Form(...),
    max_pages: int = Form(999),  # Process all pages by default
    instruction: Optional[str] = Form(None),
    # Payload options (optional)
    payload_draft: Optional[bool] = Form(None),
    payload_depth: Optional[int] = Form(None),
    payload_locale: Optional[str] = Form(None),
    payload_email: Optional[str] = Form(None),
    payload_password: Optional[str] = Form(None),
):
    """
    Splits the PDF and, for each page, extracts slide fields and creates a 'slides' item in Payload.

    Required fields in Payload collection 'slides' assumed: title, slug, description, type, parent (relation to modules), source (pdfFilename, pdfPage, module).
    """
    # Validate AI provider configuration
    if settings.ai_provider == "claude" and not settings.anthropic_api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured for Claude")
    elif settings.ai_provider == "openai" and not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured for OpenAI")
    elif settings.ai_provider not in ["claude", "openai"]:
        raise HTTPException(status_code=500, detail="AI_PROVIDER must be 'claude' or 'openai'")
    
    if not settings.payload_base_url:
        raise HTTPException(status_code=500, detail="PAYLOAD_BASE_URL not configured")

    try:
        pdf_bytes = await file.read()
        if not pdf_bytes:
            raise ValueError("Empty file")

        images_png = pdf_to_images(pdf_bytes, max_pages=max_pages)
        if not images_png:
            raise ValueError("No pages rendered from PDF")

        # Default slide extraction instruction if not provided
        default_instruction = (
            "You are a slide extraction engine. Extract slide information and return only JSON with the keys Title, Description, and Type.\n\n"
            "Rules:\n"
            "- Title: Copy the main heading exactly as shown on the slide.\n"
            "- Description: Copy the exact visible body text from the slide, preserving capitalization, punctuation, and paragraph breaks. Do not paraphrase or add any words. Exclude photo credits, page numbers, or decorative labels unless instructed otherwise.\n"
            "- Type: Select from {Regular, Video, Quiz, Reference, Resources}. If unclear, use Regular.\n"
            "- If a field is missing, use an empty string.\n"
            "- Do not include any other keys. Return a single JSON object only."
        )
        eff_instruction = instruction or default_instruction

        # Auth precedence
        auth_email = payload_email or settings.payload_email
        auth_password = payload_password or settings.payload_password
        api_token = settings.payload_api_token or None
        if not (api_token or (auth_email and auth_password)):
            raise HTTPException(status_code=500, detail="Provide PAYLOAD_API_TOKEN or PAYLOAD_EMAIL/PAYLOAD_PASSWORD (or pass via form)")

        results = []
        for idx, img in enumerate(images_png, start=1):
            # Use appropriate AI service based on provider
            if settings.ai_provider == "claude":
                extracted = await claude_extract_details_from_images(
                    png_images=[img],
                    api_key=settings.anthropic_api_key,
                    model=settings.claude_model,
                    fields=["Title", "Description", "Type"],
                    instruction=eff_instruction,
                )
            else:  # openai
                extracted = await openai_extract_details_from_images(
                    png_images=[img],
                    api_key=settings.openai_api_key,
                    model=settings.openai_model,
                    fields=["Title", "Description", "Type"],
                    instruction=eff_instruction,
                )

            # Normalize fields
            title = extracted.get("Title") or f"Page {idx}"
            description = extracted.get("Description") or ""
            typ = extracted.get("Type") or "Regular"
            typ_norm = str(typ).strip().lower()
            if typ_norm not in {"regular", "video", "quiz", "reference", "resources"}:
                typ_norm = "regular"
            import time
            timestamp = int(time.time())
            slug = slugify(f"{title} m{module_id} p{idx} {timestamp}")

            # Upload the page image to Payload CMS media collection
            image_filename = f"{slug}-page-{idx}.png"
            media_resp = await upload_image_to_payload(
                base_url=settings.payload_base_url,
                image_bytes=img,
                filename=image_filename,
                api_token=api_token,
                email=auth_email,
                password=auth_password,
                auth_collection=settings.payload_auth_collection,
            )
            
            payload_data = {
                "title": title,
                "slug": slug,
                "description": description,
                "type": typ_norm,
                "parent": module_id,  # relation to modules
                "image": media_resp["doc"]["id"],  # link to uploaded image
                "source": {
                    "pdfFilename": file.filename,
                    "pdfPage": idx,
                    "module": module_id,
                },
            }

            payload_resp = await create_payload_item(
                base_url=settings.payload_base_url,
                collection=settings.payload_default_collection or "slides",
                data=payload_data,
                api_token=api_token,
                email=auth_email,
                password=auth_password,
                auth_collection=settings.payload_auth_collection,
                draft=(payload_draft if payload_draft is not None else settings.payload_default_draft),
                depth=(payload_depth if payload_depth is not None else settings.payload_default_depth),
                locale=(payload_locale if payload_locale else settings.payload_default_locale),
            )

            results.append({
                "page": idx,
                "extracted": extracted,
                "created": payload_resp,
            })

        return {
            "pages_processed": len(images_png),
            "results": results,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
