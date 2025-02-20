import requests
import json
from pathlib import Path
from typing import Optional, Dict, Any

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
                print("✅ Login successful!")
                return True
            else:
                print("❌ No token received in response")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Login failed: {str(e)}")
            return False

    def upload_image(self, image_path: str) -> Optional[int]:
        """Upload an image and return its ID."""
        if not self.token:
            print("❌ Not authenticated. Please login first.")
            return None

        try:
            # Prepare the file
            files = {
                'file': (Path(image_path).name, open(image_path, 'rb'), 'image/jpeg')
            }
            
            # Make the request
            response = requests.post(
                f"{self.base_url}/api/media",
                headers={'Authorization': self.headers['Authorization']},
                files=files
            )
            response.raise_for_status()
            
            data = response.json()
            if data.get('doc', {}).get('id'):
                print(f"✅ Image uploaded successfully! ID: {data['doc']['id']}")
                return data['doc']['id']
            else:
                print("❌ Upload succeeded but no document ID was returned")
                return None

        except requests.exceptions.RequestException as e:
            print(f"❌ Image upload failed: {str(e)}")
            return None
        except FileNotFoundError:
            print(f"❌ Image file not found: {image_path}")
            return None

    def create_module(self, title: str, description: str, image_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Create a new module."""
        if not self.token:
            print("❌ Not authenticated. Please login first.")
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
                print(f"✅ Module created successfully! ID: {data['doc']['id']}")
                return data['doc']
            else:
                print("❌ Module creation succeeded but no document was returned")
                return None

        except requests.exceptions.RequestException as e:
            print(f"❌ Module creation failed: {str(e)}")
            return None

    def create_slide(self, 
                    title: str, 
                    description: str, 
                    slide_type: str = 'regular',
                    image_id: Optional[int] = None,
                    color_code: str = '#FF5733',
                    urls: Optional[list] = None) -> Optional[Dict[str, Any]]:
        """Create a new slide."""
        if not self.token:
            print("❌ Not authenticated. Please login first.")
            return None

        try:
            payload = {
                "title": title,
                "description": description,
                "type": slide_type,  # regular, video, quiz, reference, resources
                "image": image_id,
                "slide_color_code": color_code,
                "urls": urls or []
            }

            response = requests.post(
                f"{self.base_url}/api/slides",
                headers=self.headers,
                json=payload
            )
            response.raise_for_status()
            
            data = response.json()
            if data.get('doc', {}).get('id'):
                print(f"✅ Slide created successfully! ID: {data['doc']['id']}")
                return data['doc']
            else:
                print("❌ Slide creation succeeded but no document was returned")
                return None

        except requests.exceptions.RequestException as e:
            print(f"❌ Slide creation failed: {str(e)}")
            return None

    def update_module_slides(self, module_id: int, slide_ids: list) -> bool:
        """Update a module's slides."""
        if not self.token:
            print("❌ Not authenticated. Please login first.")
            return False

        try:
            response = requests.patch(
                f"{self.base_url}/api/modules/{module_id}",
                headers=self.headers,
                json={"slides": slide_ids}
            )
            response.raise_for_status()
            
            data = response.json()
            if data.get('doc', {}).get('id'):
                print(f"✅ Module slides updated successfully!")
                return True
            return False

        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to update module slides: {str(e)}")
            return False

def main():
    # Initialize the API client
    api = PayloadCMSAPI()

    # Login
    if not api.login("abenuro@gmail.com", "abenuro@gmail.com"):
        return

    # Upload an image
    image_path = "/Users/abenezernuro/Documents/work2025/Rs_cms/rs-cms/Free-Stock-Photos-01.jpg"
    image_id = api.upload_image(image_path)
    if not image_id:
        return

    # Create a module
    module = api.create_module(
        title="Safety Training Module",
        description="Comprehensive guide to workplace safety protocols",
        image_id=image_id
    )
    if not module:
        return

    # Create a slide
    slide = api.create_slide(
        title="Workplace Safety Introduction",
        description="Essential safety guidelines for all employees",
        slide_type="regular",
        image_id=image_id,
        color_code="#FF5733",
        urls=[
            {"url": "https://www.osha.gov/safety-protocols"},
            {"url": "https://www.safety-training.com/basics"}
        ]
    )
    if not slide:
        return

    # Add the slide to the module
    if module and slide:
        api.update_module_slides(module['id'], [slide['id']])

if __name__ == "__main__":
    main() 