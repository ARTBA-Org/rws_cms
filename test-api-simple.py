#!/usr/bin/env python3
"""
Simple API test using existing endpoints
"""

import requests
import json
import time

def test_existing_endpoints():
    """Test using existing endpoints"""
    print("🧪 Testing with existing endpoints...")
    
    # Test 1: Lambda health
    print("\n1. Testing Lambda health...")
    try:
        response = requests.get("https://t9xzxhl1ed.execute-api.us-east-1.amazonaws.com/Prod/health")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            print(f"   ✅ Lambda healthy: {response.json()}")
        else:
            print(f"   ❌ Lambda error: {response.text}")
    except Exception as e:
        print(f"   ❌ Lambda connection failed: {e}")
    
    # Test 2: Next.js PDF processing
    print("\n2. Testing Next.js PDF processing...")
    try:
        payload = {"moduleId": "85"}
        response = requests.post(
            "http://localhost:3001/api/process-module-pdf", 
            json=payload, 
            timeout=60
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Processing successful:")
            print(f"      Success: {data.get('success', False)}")
            print(f"      Slides created: {data.get('slidesCreated', 0)}")
            print(f"      Pages processed: {data.get('processed', [])}")
            print(f"      Total pages: {data.get('totalPages', 0)}")
        else:
            print(f"   ❌ Processing failed: {response.text}")
    except Exception as e:
        print(f"   ❌ Processing error: {e}")
    
    # Test 3: Check if we can access the module directly
    print("\n3. Testing module access...")
    try:
        # This might not work from external API, but let's try
        response = requests.get("http://localhost:3001/api/modules/85")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            print(f"   ✅ Module accessible")
        else:
            print(f"   ❌ Module not accessible: {response.text}")
    except Exception as e:
        print(f"   ❌ Module access error: {e}")

def test_lambda_directly():
    """Test Lambda function directly with a real PDF"""
    print("\n4. Testing Lambda directly with sample PDF...")
    
    # Create a more realistic test PDF
    test_pdf_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj
4 0 obj
<<
/Length 120
>>
stream
BT
/F1 24 Tf
100 700 Td
(Sample PDF Content) Tj
0 -50 Td
/F1 12 Tf
(This is a test slide with some content) Tj
0 -20 Td
(Key points: Testing, Analysis, Results) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000330 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
501
%%EOF"""
    
    try:
        files = {'file': ('sample.pdf', test_pdf_content, 'application/pdf')}
        response = requests.post(
            "https://t9xzxhl1ed.execute-api.us-east-1.amazonaws.com/Prod/process-pdf-with-ai", 
            files=files, 
            timeout=60
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Lambda processing successful:")
            print(f"      Pages: {data.get('page_count', 0)}")
            print(f"      Results: {len(data.get('results', []))}")
            
            if data.get('results'):
                result = data['results'][0]
                analysis = result.get('analysis', {})
                print(f"      Analysis title: {analysis.get('title', 'No title')}")
                print(f"      Summary: {analysis.get('summary', 'No summary')[:100]}...")
                print(f"      Key points: {analysis.get('key_points', [])}")
        else:
            print(f"   ❌ Lambda processing failed: {response.text}")
            
    except Exception as e:
        print(f"   ❌ Lambda processing error: {e}")

def main():
    print("🔍 Simple API Testing")
    print("=" * 40)
    
    test_existing_endpoints()
    test_lambda_directly()
    
    print("\n" + "=" * 40)
    print("📋 Summary")
    print("=" * 40)
    print("✅ If Lambda tests pass: Your Lambda function is working correctly")
    print("✅ If Next.js processing passes: Your API integration is working")
    print("💡 The main issue is likely that AI can't see PDF content properly")
    print("🚀 Solution: Deploy the improved version for better image processing")

if __name__ == "__main__":
    main()