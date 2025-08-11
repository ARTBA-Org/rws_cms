#!/usr/bin/env python3
"""
Local testing script for the PDF processor service
"""
import requests
import os
from pathlib import Path

def test_health():
    """Test the health endpoint"""
    try:
        response = requests.get("http://localhost:8080/health")
        print(f"Health check: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_pdf_conversion(pdf_path):
    """Test PDF conversion endpoint"""
    if not os.path.exists(pdf_path):
        print(f"PDF file not found: {pdf_path}")
        return False
    
    try:
        with open(pdf_path, 'rb') as f:
            files = {'file': ('test.pdf', f, 'application/pdf')}
            response = requests.post("http://localhost:8080/convert-pdf", files=files)
        
        print(f"PDF conversion: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Success: {result['success']}")
            print(f"Pages converted: {result['page_count']}")
            return True
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"PDF conversion failed: {e}")
        return False

def test_pdf_ai_processing(pdf_path):
    """Test PDF AI processing endpoint"""
    if not os.path.exists(pdf_path):
        print(f"PDF file not found: {pdf_path}")
        return False
    
    try:
        with open(pdf_path, 'rb') as f:
            files = {'file': ('test.pdf', f, 'application/pdf')}
            response = requests.post("http://localhost:8080/process-pdf-with-ai", files=files)
        
        print(f"PDF AI processing: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Success: {result['success']}")
            print(f"Pages processed: {result['page_count']}")
            
            # Show first page analysis
            if result['results']:
                first_page = result['results'][0]
                print(f"\nFirst page analysis:")
                print(f"Title: {first_page['analysis']['title']}")
                print(f"Topic: {first_page['analysis']['topic']}")
                print(f"Summary: {first_page['analysis']['summary'][:100]}...")
            
            return True
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"PDF AI processing failed: {e}")
        return False

def main():
    print("🧪 Testing PDF Processor Service Locally")
    print("=" * 50)
    
    # Test health endpoint
    print("\n1. Testing health endpoint...")
    if not test_health():
        print("❌ Service is not running. Start it with: python main.py")
        return
    
    # Look for a test PDF file
    test_pdf = None
    possible_paths = [
        "test.pdf",
        "../test.pdf", 
        "sample.pdf",
        "../sample.pdf"
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            test_pdf = path
            break
    
    if not test_pdf:
        print("\n⚠️  No test PDF found. Please add a test.pdf file to test the endpoints.")
        print("You can download a sample PDF or create one for testing.")
        return
    
    print(f"\n2. Testing PDF conversion with: {test_pdf}")
    test_pdf_conversion(test_pdf)
    
    print(f"\n3. Testing PDF AI processing with: {test_pdf}")
    test_pdf_ai_processing(test_pdf)
    
    print("\n✅ Local testing complete!")

if __name__ == "__main__":
    main()