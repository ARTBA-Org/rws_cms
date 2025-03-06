#!/bin/bash

# Test script to check module-slide limits

echo "===== Testing for Module-Slide Limits ====="
echo "This series of tests will determine if there's a 10-slide limit"
echo "and if so, where it's coming from."
echo ""

# Install dependencies if needed
if ! command -v node &> /dev/null; then
    echo "Node.js is required to run these tests"
    exit 1
fi

# Check if the test directory exists
if [ ! -d "test" ]; then
    echo "Test directory not found. Make sure you're in the project root."
    exit 1
fi

# Run the direct API test
echo "=== Test 1: Direct API test ==="
echo "This test will check if we can retrieve more than 10 slides from the API"
echo ""
node test/direct_api_test.js

echo ""
echo "===== Test Summary ====="
echo "If any test showed the ability to retrieve or add more than 10 slides,"
echo "then there is no hard 10-slide limit in the API or database."
echo ""
echo "Recommendations:"
echo "1. Make sure the 'Max rows' setting in Supabase is set to at least 1000"
echo "2. Look for pagination controls in the admin UI when viewing modules/slides"
echo "3. Check if you're seeing exactly 10 slides in every module (suggests a limit)"
echo "4. Try adding slides one at a time instead of all at once"
echo ""
echo "Note: If you're using PDF uploads to create slides, there might be"
echo "a limit in the PDF processing code rather than the database itself." 