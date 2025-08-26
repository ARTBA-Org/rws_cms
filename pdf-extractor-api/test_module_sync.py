#!/usr/bin/env python3
"""
Test script to sync module slides
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.payload_client import update_module_slides
from dotenv import load_dotenv

load_dotenv()

async def test_sync_module_17():
    """Test syncing module 17 with all its slides"""
    try:
        result = await update_module_slides(
            base_url=os.environ.get("PAYLOAD_BASE_URL"),
            module_id=17,
            api_token=os.environ.get("PAYLOAD_API_TOKEN"),
        )
        
        print("✅ Module sync successful!")
        print(f"📊 {result['message']}")
        print(f"🔗 Slide IDs: {result['slide_ids']}")
        print(f"📁 Updated module slides array: {result['module']['doc']['slides']}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_sync_module_17())