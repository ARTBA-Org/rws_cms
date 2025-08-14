#!/bin/bash

# Local API Testing Script for PDF Processing
# Usage: ./scripts/test-pdf-api.sh [module_id]

MODULE_ID=${1:-85}
PORT=${PORT:-3001}
BASE_URL="http://localhost:$PORT"

echo "🚀 Testing PDF Processing API Locally"
echo "=================================="
echo "Module ID: $MODULE_ID"
echo "Server: $BASE_URL"
echo ""

# Function to test with different configurations
test_config() {
    local name=$1
    local use_optimized=$2
    local max_pages=$3
    local timeout_ms=$4
    local enable_images=$5
    
    echo "Testing: $name"
    echo "Configuration:"
    echo "  - Use Optimized: $use_optimized"
    echo "  - Max Pages: $max_pages"
    echo "  - Timeout: ${timeout_ms}ms"
    echo "  - Images: $enable_images"
    echo ""
    
    # Create the JSON payload
    cat > /tmp/pdf-test-payload.json <<EOF
{
  "moduleId": "$MODULE_ID",
  "useOptimized": $use_optimized,
  "processorConfig": {
    "maxPages": $max_pages,
    "timeoutMs": $timeout_ms,
    "enableImages": $enable_images,
    "batchSize": 1
  }
}
EOF
    
    # Make the API call
    echo "Sending request..."
    response=$(curl -X POST "$BASE_URL/api/test-process-module-pdf" \
        -H "Content-Type: application/json" \
        -d @/tmp/pdf-test-payload.json \
        -s -w "\nHTTP_STATUS:%{http_code}\nTIME_TOTAL:%{time_total}s")
    
    # Extract status and time
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    time_total=$(echo "$response" | grep "TIME_TOTAL:" | cut -d: -f2)
    body=$(echo "$response" | sed -n '1,/HTTP_STATUS:/p' | sed '$d')
    
    # Parse and display results
    echo "Response Status: $http_status"
    echo "Time Taken: $time_total"
    
    if [ "$http_status" = "200" ]; then
        echo "✅ Success!"
        echo "$body" | jq '{success, slidesCreated, pagesProcessed, totalPages, timeElapsed}' 2>/dev/null || echo "$body"
    else
        echo "❌ Failed!"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi
    
    echo ""
    echo "---"
    echo ""
}

# Check if server is running
echo "Checking if server is running..."
if ! curl -s "$BASE_URL/admin" > /dev/null 2>&1; then
    echo "❌ Server is not running on port $PORT"
    echo ""
    echo "Start the server with:"
    echo "  npm run dev"
    echo ""
    exit 1
fi
echo "✅ Server is running"
echo ""

# Run different test configurations
echo "=================================="
echo "Test 1: Fast Mode (Text Only)"
echo "=================================="
test_config "Fast Mode" true 5 30000 false

echo "=================================="
echo "Test 2: Standard Mode (3 Pages)"
echo "=================================="
test_config "Standard Mode" true 3 25000 true

echo "=================================="
echo "Test 3: Full Mode (All Pages)"
echo "=================================="
test_config "Full Mode" true 10 60000 true

echo "=================================="
echo "Test Complete!"
echo ""
echo "To test with a specific module:"
echo "  ./scripts/test-pdf-api.sh [module_id]"
echo ""
echo "To monitor in real-time:"
echo "  npm run dev"
echo "  Then check the console output"