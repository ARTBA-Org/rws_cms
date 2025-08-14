#!/usr/bin/env python3
"""
Quick test script to check if the Lambda function is working
"""

import requests
import os

# Test the Lambda function
API_BASE = "https://t9xzxhl1ed.execute-api.us-east-1.amazonaws.com/Prod"

def test_health():
    """Test health endpoint"""
    print("🏥 Testing health endpoint...")
    response = requests.get(f"{API_BASE}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    return response.status_code == 200

def test_pdf_processing():
    """Test PDF processing with a small test file"""
    print("\n📄 Testing PDF processing...")
    
    # Create a minimal test - just check if the endpoint responds
    try:
        # Try with empty request to see the error
        response = requests.post(f"{API_BASE}/process-pdf-with-ai")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        # If we get 422 (validation error), that means the endpoint is working
        # If we get 500 with "OpenAI API key not configured", that's the issue
        return response.status_code in [422, 500]
        
    except Exception as e:
        print(f"Error: {e}")
        return False

def main():
    print("🧪 Testing Lambda Function")
    print("=" * 40)
    
    health_ok = test_health()
    processing_ok = test_pdf_processing()
    
    print("\n" + "=" * 40)
    print("📋 Test Results")
    print("=" * 40)
    print(f"✅ Health Check: {'PASS' if health_ok else 'FAIL'}")
    print(f"🔍 Processing Endpoint: {'ACCESSIBLE' if processing_ok else 'FAIL'}")
    
    if health_ok and processing_ok:
        print("\n💡 Lambda function is accessible. The issue is likely:")
        print("   1. Missing OpenAI API key in Lambda environment")
        print("   2. Request format issue")
        print("   3. File upload handling problem")
    else:
        print("\n❌ Lambda function has issues. Check deployment.")

if __name__ == "__main__":
    main()