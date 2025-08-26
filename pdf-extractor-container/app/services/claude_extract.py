import base64
import json
from typing import Dict, List, Optional

import anthropic


async def extract_details_from_images(
    png_images: List[bytes],
    api_key: str,
    model: str = "claude-3-5-sonnet-20241022",
    fields: List[str] = None,
    instruction: Optional[str] = None,
) -> Dict:
    """
    Extract details from PDF page images using Claude API.
    """
    if fields is None:
        fields = ["title", "date", "total", "vendor", "items"]

    client = anthropic.Anthropic(api_key=api_key)

    # Build the instruction prompt
    field_list = ", ".join(fields)
    default_instruction = f"Extract the following information from this document image: {field_list}. Return the result as a JSON object."
    effective_instruction = instruction or default_instruction

    # If multiple images, process each and combine results
    if len(png_images) == 1:
        # Single image processing
        image_data = base64.b64encode(png_images[0]).decode("utf-8")
        
        try:
            response = client.messages.create(
                model=model,
                max_tokens=4000,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": effective_instruction
                            },
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": image_data
                                }
                            }
                        ]
                    }
                ]
            )
            
            # Extract the text response
            result_text = response.content[0].text if response.content else ""
            
            # Try to parse as JSON, fallback to structured text
            try:
                return json.loads(result_text)
            except json.JSONDecodeError:
                # If not valid JSON, try to extract structured information
                return parse_text_response(result_text, fields)
                
        except Exception as e:
            # Return basic structure on error
            return {field: f"Error extracting {field}: {str(e)}" for field in fields}
    
    else:
        # Multiple images - process as slides
        results = {"slides": []}
        
        for i, img_bytes in enumerate(png_images):
            image_data = base64.b64encode(img_bytes).decode("utf-8")
            
            try:
                response = client.messages.create(
                    model=model,
                    max_tokens=4000,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": f"Page {i+1}: {effective_instruction}"
                                },
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": "image/png",
                                        "data": image_data
                                    }
                                }
                            ]
                        }
                    ]
                )
                
                result_text = response.content[0].text if response.content else ""
                
                try:
                    page_result = json.loads(result_text)
                except json.JSONDecodeError:
                    page_result = parse_text_response(result_text, fields)
                
                results["slides"].append(page_result)
                
            except Exception as e:
                # Add error result for this page
                error_result = {field: f"Error extracting {field}: {str(e)}" for field in fields}
                results["slides"].append(error_result)
        
        return results


def parse_text_response(text: str, fields: List[str]) -> Dict:
    """
    Parse a text response into structured fields when JSON parsing fails.
    """
    result = {}
    text_lower = text.lower()
    
    for field in fields:
        field_lower = field.lower()
        # Try to find the field in the text
        if field_lower in text_lower:
            # Extract content after the field name
            start_idx = text_lower.find(field_lower)
            if start_idx != -1:
                # Look for content after field name (after colon or field name)
                content_start = start_idx + len(field_lower)
                # Skip common separators
                while content_start < len(text) and text[content_start] in ': \n\t-=':
                    content_start += 1
                
                # Find end of content (next line or sentence)
                content_end = content_start
                while content_end < len(text) and text[content_end] not in '\n.;':
                    content_end += 1
                
                if content_start < len(text):
                    result[field] = text[content_start:content_end].strip()
                else:
                    result[field] = ""
            else:
                result[field] = ""
        else:
            result[field] = ""
    
    return result