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
            print(f"Attempting to login with email: {email}")
            response = requests.post(
                f"{self.base_url}/api/users/login",
                json={
                    "email": email,
                    "password": password
                }
            )
            response.raise_for_status()
            data = response.json()
            print("Login response:", json.dumps(data, indent=2))
            
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
            print(f"Uploading image from path: {image_path}")
            
            # Verify file exists
            if not Path(image_path).exists():
                print(f"❌ Image file not found at path: {image_path}")
                return None

            # Read file content
            with open(image_path, 'rb') as f:
                file_content = f.read()
                print(f"Read {len(file_content)} bytes from file")

            # Prepare multipart form data
            files = {
                'file': (Path(image_path).name, file_content, 'image/jpeg')
            }
            
            print("Sending upload request...")
            print("Headers:", self.headers)
            
            response = requests.post(
                f"{self.base_url}/api/media",
                headers={'Authorization': self.headers['Authorization']},
                files=files
            )

            print(f"Upload response status: {response.status_code}")
            print("Response headers:", response.headers)
            
            try:
                data = response.json()
                print("Upload response data:", json.dumps(data, indent=2))
            except json.JSONDecodeError:
                print("Raw response:", response.text)
                raise

            if response.ok and data.get('doc', {}).get('id'):
                print(f"✅ Image uploaded successfully! ID: {data['doc']['id']}")
                return data['doc']['id']
            else:
                print("❌ Upload failed or no document ID returned")
                return None

        except Exception as e:
            print(f"❌ Error uploading image: {str(e)}")
            import traceback
            traceback.print_exc()
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
                "slides": [],
                "slidesColor": "#4287f5"
            }

            print("Creating module with payload:", json.dumps(payload, indent=2))
            response = requests.post(
                f"{self.base_url}/api/modules",
                headers=self.headers,
                json=payload
            )
            
            print(f"Module creation response status: {response.status_code}")
            data = response.json()
            print("Module creation response:", json.dumps(data, indent=2))

            if response.ok and data.get('doc', {}).get('id'):
                print(f"✅ Module created successfully! ID: {data['doc']['id']}")
                return data['doc']
            else:
                print("❌ Module creation failed or no document returned")
                return None

        except Exception as e:
            print(f"❌ Module creation failed: {str(e)}")
            import traceback
            traceback.print_exc()
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
                "type": slide_type,
                "image": image_id,
                "slide_color_code": color_code,
                "urls": urls or []
            }

            print("Creating slide with payload:", json.dumps(payload, indent=2))
            response = requests.post(
                f"{self.base_url}/api/slides",
                headers=self.headers,
                json=payload
            )
            
            print(f"Slide creation response status: {response.status_code}")
            data = response.json()
            print("Slide creation response:", json.dumps(data, indent=2))

            if response.ok and data.get('doc', {}).get('id'):
                print(f"✅ Slide created successfully! ID: {data['doc']['id']}")
                return data['doc']
            else:
                print("❌ Slide creation failed or no document returned")
                return None

        except Exception as e:
            print(f"❌ Slide creation failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    def update_module_slides(self, module_id: int, slide_ids: list) -> bool:
        """Update a module's slides."""
        if not self.token:
            print("❌ Not authenticated. Please login first.")
            return False

        try:
            payload = {"slides": slide_ids}
            print(f"Updating module {module_id} with slides:", json.dumps(payload, indent=2))
            
            response = requests.patch(
                f"{self.base_url}/api/modules/{module_id}",
                headers=self.headers,
                json=payload
            )
            
            print(f"Module update response status: {response.status_code}")
            data = response.json()
            print("Module update response:", json.dumps(data, indent=2))

            if response.ok and data.get('doc', {}).get('id'):
                print(f"✅ Module slides updated successfully!")
                return True
            else:
                print("❌ Module update failed")
                return False

        except Exception as e:
            print(f"❌ Failed to update module slides: {str(e)}")
            import traceback
            traceback.print_exc()
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