from typing import Any, Dict, Optional

import httpx


async def _login_and_get_jwt(base_url: str, email: str, password: str, auth_collection: str = "users") -> str:
    """Login to Payload to get a JWT token using email/password."""
    login_url = f"{base_url.rstrip('/')}/api/{auth_collection}/login"
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(login_url, json={"email": email, "password": password})
        r.raise_for_status()
        data = r.json()
        token = data.get("token")
        if not token:
            raise RuntimeError("Payload login did not return a token")
        return token


async def create_payload_item(
    base_url: str,
    collection: str,
    data: Dict[str, Any],
    api_token: Optional[str] = None,
    email: Optional[str] = None,
    password: Optional[str] = None,
    auth_collection: str = "users",
    draft: Optional[bool] = None,
    depth: Optional[int] = None,
    locale: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Creates an item in Payload CMS using its REST API: POST /api/{collection}

    Auth:
      - If api_token is provided, uses Authorization: Bearer <token>.
      - Else if email/password provided, performs /api/users/login and uses Authorization: JWT <token>.

    Options:
      - draft: if True, saves as draft
      - depth: population depth for relationships
      - locale: locale code
    """
    headers: Dict[str, str] = {"Content-Type": "application/json"}

    if api_token:
        headers["Authorization"] = f"JWT {api_token}"
    elif email and password:
        jwt = await _login_and_get_jwt(base_url, email, password, auth_collection=auth_collection)
        headers["Authorization"] = f"JWT {jwt}"
    else:
        raise ValueError("Either api_token or email/password must be provided for Payload authentication")

    url = f"{base_url.rstrip('/')}/api/{collection}"
    params: Dict[str, Any] = {}
    if draft is True:
        params["draft"] = "true"
    if depth is not None:
        params["depth"] = str(depth)
    if locale:
        params["locale"] = locale

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, params=params, json=data)
        # Raise with response content for easier debugging
        try:
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            detail = None
            try:
                detail = r.json()
            except Exception:
                detail = r.text
            raise httpx.HTTPStatusError(f"Payload error {r.status_code}: {detail}", request=e.request, response=e.response)
        return r.json()


async def upload_image_to_payload(
    base_url: str,
    image_bytes: bytes,
    filename: str,
    api_token: Optional[str] = None,
    email: Optional[str] = None,
    password: Optional[str] = None,
    auth_collection: str = "users",
) -> Dict[str, Any]:
    """
    Upload an image to Payload CMS media collection.
    
    Returns the media item response with ID that can be used in other collections.
    """
    headers: Dict[str, str] = {}

    if api_token:
        headers["Authorization"] = f"JWT {api_token}"
    elif email and password:
        jwt = await _login_and_get_jwt(base_url, email, password, auth_collection=auth_collection)
        headers["Authorization"] = f"JWT {jwt}"
    else:
        raise ValueError("Either api_token or email/password must be provided for Payload authentication")

    url = f"{base_url.rstrip('/')}/api/media"
    
    # Create multipart form data for file upload
    files = {"file": (filename, image_bytes, "image/png")}
    data = {"alt": f"Generated from {filename}"}

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, files=files, data=data)
        try:
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            detail = None
            try:
                detail = r.json()
            except Exception:
                detail = r.text
            raise httpx.HTTPStatusError(f"Payload media upload error {r.status_code}: {detail}", request=e.request, response=e.response)
        return r.json()


async def update_module_slides(
    base_url: str,
    module_id: int,
    api_token: Optional[str] = None,
    email: Optional[str] = None,
    password: Optional[str] = None,
    auth_collection: str = "users",
) -> Dict[str, Any]:
    """
    Update a module to include all slides that have this module as parent.
    
    This ensures the module's slides array is synchronized with all its child slides.
    """
    headers: Dict[str, str] = {"Content-Type": "application/json"}

    if api_token:
        headers["Authorization"] = f"JWT {api_token}"
    elif email and password:
        jwt = await _login_and_get_jwt(base_url, email, password, auth_collection=auth_collection)
        headers["Authorization"] = f"JWT {jwt}"
    else:
        raise ValueError("Either api_token or email/password must be provided for Payload authentication")

    async with httpx.AsyncClient(timeout=60) as client:
        # First, get all slides that belong to this module
        slides_url = f"{base_url.rstrip('/')}/api/slides"
        slides_params = {"where": f"parent={module_id}", "limit": 1000}
        
        slides_resp = await client.get(slides_url, headers=headers, params=slides_params)
        slides_resp.raise_for_status()
        slides_data = slides_resp.json()
        
        # Extract slide IDs
        slide_ids = [slide["id"] for slide in slides_data.get("docs", [])]
        
        if not slide_ids:
            return {"message": "No slides found for this module"}
        
        # Update the module with all slide IDs
        module_url = f"{base_url.rstrip('/')}/api/modules/{module_id}"
        update_data = {"slides": slide_ids}
        
        module_resp = await client.patch(module_url, headers=headers, json=update_data)
        try:
            module_resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            detail = None
            try:
                detail = module_resp.json()
            except Exception:
                detail = module_resp.text
            raise httpx.HTTPStatusError(f"Module update error {module_resp.status_code}: {detail}", request=e.request, response=e.response)
            
        return {
            "message": f"Module {module_id} updated with {len(slide_ids)} slides",
            "slide_ids": slide_ids,
            "module": module_resp.json()
        }
