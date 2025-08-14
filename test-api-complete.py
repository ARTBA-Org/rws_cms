#!/usr/bin/env python3
"""
Complete API test script to debug the PDF processing pipeline
"""

import requests
import json
import time
import os

# Configuration
NEXT_API_BASE = "http://localhost:3000/api"
LAMBDA_API_BASE = "https://t9xzxhl1ed.execute-api.us-east-1.amazonaws.com/Prod"

def test_next_js_health():
    """Test if Next.js is running"""
    print("🏥 Testing Next.js server...")
    try:
        response = requests.get(f"{NEXT_API_BASE}/check-slides?moduleId=85", timeout=10)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Next.js working - Module has {data.get('slidesInModule', 0)} slides")
            return True
        else:
            print(f"❌ Next.js error: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Next.js connection failed: {e}")
        return False

def test_lambda_health():
    """Test Lambda function health"""
    print("\n🔧 Testing Lambda function...")
    try:
        response = requests.get(f"{LAMBDA_API_BASE}/health", timeout=10)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Lambda working - {data.get('service', 'Unknown')}")
            return True
        else:
            print(f"❌ Lambda error: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Lambda connection failed: {e}")
        return False

def test_lambda_pdf_processing():
    """Test Lambda PDF processing with a real file"""
    print("\n📄 Testing Lambda PDF processing...")
    
    # Create a simple test PDF
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
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Hello World Test) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000189 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
284
%%EOF"""
    
    try:
        files = {'file': ('test.pdf', test_pdf_content, 'application/pdf')}
        response = requests.post(f"{LAMBDA_API_BASE}/process-pdf-with-ai", files=files, timeout=60)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Lambda PDF processing working")
            print(f"   Pages processed: {data.get('page_count', 0)}")
            print(f"   Results: {len(data.get('results', []))}")
            
            # Show first result
            if data.get('results'):
                first_result = data['results'][0]
                analysis = first_result.get('analysis', {})
                print(f"   First page analysis: {analysis.get('title', 'No title')}")
                print(f"   Summary: {analysis.get('summary', 'No summary')[:100]}...")
            
            return True
        else:
            print(f"❌ Lambda PDF processing failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Lambda PDF processing error: {e}")
        return False

def test_next_js_pdf_processing():
    """Test Next.js PDF processing endpoint"""
    print("\n🔄 Testing Next.js PDF processing...")
    
    try:
        payload = {"moduleId": "85"}
        response = requests.post(
            f"{NEXT_API_BASE}/process-module-pdf", 
            json=payload, 
            timeout=120
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Next.js PDF processing working")
            print(f"   Success: {data.get('success', False)}")
            print(f"   Slides created: {data.get('slidesCreated', 0)}")
            print(f"   Pages processed: {data.get('processed', [])}")
            return True
        else:
            print(f"❌ Next.js PDF processing failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Next.js PDF processing error: {e}")
        return False

def test_slide_creation():
    """Test if slides are actually being created"""
    print("\n📋 Testing slide creation...")
    
    try:
        # Get slides before
        response_before = requests.get(f"{NEXT_API_BASE}/check-slides?moduleId=85")
        slides_before = response_before.json().get('slidesInModule', 0) if response_before.status_code == 200 else 0
        
        print(f"Slides before: {slides_before}")
        
        # Process PDF
        payload = {"moduleId": "85"}
        process_response = requests.post(
            f"{NEXT_API_BASE}/process-module-pdf", 
            json=payload, 
            timeout=120
        )
        
        if process_response.status_code != 200:
            print(f"❌ Processing failed: {process_response.text}")
            return False
        
        # Wait a moment
        time.sleep(2)
        
        # Get slides after
        response_after = requests.get(f"{NEXT_API_BASE}/check-slides?moduleId=85")
        if response_after.status_code == 200:
            data = response_after.json()
            slides_after = data.get('slidesInModule', 0)
            recent_slides = data.get('recentSlidesData', [])
            
            print(f"Slides after: {slides_after}")
            print(f"New slides created: {slides_after - slides_before}")
            
            if recent_slides:
                print("Recent slides:")
                for slide in recent_slides[:3]:
                    print(f"   - {slide.get('title', 'No title')}")
                    print(f"     {slide.get('description', 'No description')[:100]}...")
            
            return slides_after > slides_before
        else:
            print(f"❌ Failed to check slides after: {response_after.text}")
            return False
            
    except Exception as e:
        print(f"❌ Slide creation test error: {e}")
        return False

def main():
    print("🧪 Complete API Testing Suite")
    print("=" * 50)
    
    tests = [
        ("Next.js Health", test_next_js_health),
        ("Lambda Health", test_lambda_health),
        ("Lambda PDF Processing", test_lambda_pdf_processing),
        ("Next.js PDF Processing", test_next_js_pdf_processing),
        ("Slide Creation", test_slide_creation),
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            success = test_func()
            results[test_name] = success
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results[test_name] = False
        
        time.sleep(1)  # Brief pause between tests
    
    # Summary
    print("\n" + "=" * 50)
    print("📋 Test Summary")
    print("=" * 50)
    
    passed = sum(1 for success in results.values() if success)
    total = len(results)
    
    for test_name, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Your API is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the details above.")
        
        # Provide specific guidance
        if not results.get("Next.js Health"):
            print("\n💡 Next.js server issues:")
            print("   - Make sure your Next.js server is running on port 3000")
            print("   - Check for compilation errors")
            
        if not results.get("Lambda Health"):
            print("\n💡 Lambda function issues:")
            print("   - Check AWS credentials and region")
            print("   - Verify the Lambda function is deployed")
            
        if not results.get("Lambda PDF Processing"):
            print("\n💡 Lambda PDF processing issues:")
            print("   - Check if OpenAI API key is configured in Lambda")
            print("   - Verify Lambda has enough memory and timeout")
            
        if not results.get("Slide Creation"):
            print("\n💡 Slide creation issues:")
            print("   - Check Payload CMS database connection")
            print("   - Verify slide collection schema")
            print("   - Check for permission issues")

if __name__ == "__main__":
    main()