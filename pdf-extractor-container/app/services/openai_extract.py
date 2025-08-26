import base64
import json
from typing import List, Optional, Dict, Any

from openai import OpenAI


def _to_data_uri(png_bytes: bytes) -> str:
    b64 = base64.b64encode(png_bytes).decode("utf-8")
    return f"data:image/png;base64,{b64}"


async def extract_details_from_images(
    png_images: List[bytes],
    api_key: str,
    model: str = "gpt-4o-mini",
    fields: Optional[List[str]] = None,
    instruction: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Uses OpenAI Responses API with multimodal input (images) to extract JSON-only output.

    - If `instruction` is provided, it's sent as a developer message.
    - Otherwise, a default instruction is constructed from `fields`.
    """
    client = OpenAI(api_key=api_key)

    if instruction is None:
        if not fields:
            fields = ["title", "date", "total", "vendor", "items"]
        instruction = (
            "You are a precise data extraction engine. Extract the following fields from the document images as JSON. "
            "Return ONLY valid JSON with these keys. If a field is missing, use null. "
            f"Fields: {', '.join(fields)}. For `items`, if present, return an array of objects with sensible keys."
        )

    # Build Responses API input with developer instructions and user-provided images
    input_payload: List[Dict[str, Any]] = [
        {
            "role": "developer",
            "content": [
                {"type": "input_text", "text": instruction},
            ],
        },
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": "Use the following document images to extract the data as instructed."},
                *[
                    {"type": "input_image", "image_url": {"url": _to_data_uri(img)}}
                    for img in png_images
                ],
            ],
        },
    ]

    try:
        resp = client.responses.create(
            model=model,
            input=input_payload,
            text={"format": {"type": "json_object"}},
        )
        # Preferred accessor in SDK >=1.40
        text_out = getattr(resp, "output_text", None)
        if not text_out:
            # Fallback attempt for generic structure
            text_out = ""
            try:
                output = getattr(resp, "output", None)
                if output and len(output) > 0:
                    first = output[0]
                    content = getattr(first, "content", None) or first.get("content")
                    if content and len(content) > 0:
                        part = content[0]
                        text_out = getattr(part, "text", None) or part.get("text", "")
            except Exception:
                pass
    except Exception:
        # Fallback to Chat Completions if Responses API/model unavailable
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a precise data extraction engine. Output strictly valid JSON."},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": instruction},
                        *[
                            {"type": "image_url", "image_url": {"url": _to_data_uri(img)}}
                            for img in png_images
                        ],
                    ],
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        text_out = resp.choices[0].message.content if resp.choices else "{}"

    text_out = text_out or "{}"
    try:
        data = json.loads(text_out)
    except Exception:
        data = {"raw": text_out}

    return data
