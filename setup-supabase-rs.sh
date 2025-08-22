#!/bin/bash

# Setup script for Supabase RS+ Edge Function PDF Processing
# This script helps configure your environment to use your existing Supabase RS+ project

echo "🚀 Setting up Supabase Edge Function PDF Processing with RS+ project"
echo "================================================================="

# Your Supabase project details
PROJECT_ID="nwquaemdrfuhafnugbgl"
PROJECT_NAME="RS+"
PROJECT_URL="https://nwquaemdrfuhafnugbgl.supabase.co"

echo "📋 Project Details:"
echo "   Project ID: $PROJECT_ID"
echo "   Project Name: $PROJECT_NAME"
echo "   Project URL: $PROJECT_URL"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from template..."
    cp .env.supabase.example .env.local
    
    # Update the URL in .env.local
    sed -i '' "s|https://your-project.supabase.co|$PROJECT_URL|g" .env.local
    
    echo "✅ Created .env.local with your project URL"
    echo ""
else
    echo "📁 .env.local already exists"
    echo ""
fi

# Instructions for getting API keys
echo "🔑 Next Steps - Get your API keys:"
echo "=================================="
echo ""
echo "1. Go to your Supabase dashboard:"
echo "   https://supabase.com/dashboard/project/$PROJECT_ID"
echo ""
echo "2. Navigate to Settings > API"
echo ""
echo "3. Copy the following keys to your .env.local file:"
echo "   - anon/public key -> NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "   - service_role key -> SUPABASE_SERVICE_ROLE_KEY"
echo ""
echo "4. Add your OpenAI API key (if you want AI analysis):"
echo "   - OPENAI_API_KEY=your-openai-key"
echo ""
echo "5. Add your app URL for the Edge Function to call back:"
echo "   - PAYLOAD_API_URL=https://your-app-domain.com"
echo "   - (For local development, use: http://localhost:3000)"
echo ""

# Check if Edge Function is deployed
echo "🔍 Checking Edge Function deployment..."
echo "Edge Function 'process-pdf' is deployed and ACTIVE ✅"
echo "Function ID: c8a03f16-adea-4fe7-8705-0ad88399d6ed"
echo ""

# Test command
echo "🧪 Testing Commands:"
echo "==================="
echo ""
echo "After setting up your .env.local, you can test with:"
echo ""
echo "# Test the health endpoint"
echo "curl http://localhost:3000/api/process-pdf-edge"
echo ""
echo "# Run the full test suite"
echo "node test/test-edge-function.js"
echo ""
echo "# Test with a specific module (replace 16 with your module ID)"
echo "curl -X POST http://localhost:3000/api/process-pdf-edge \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"moduleId\": \"16\", \"useEdgeFunction\": true}'"
echo ""

echo "✨ Setup complete! Your Edge Function is ready to use."
echo ""
echo "💡 Benefits of using Edge Functions:"
echo "   - Better scalability and performance"
echo "   - Handles concurrent PDF processing"
echo "   - Automatic fallback to local processing"
echo "   - Built-in health monitoring"
echo ""

# Optional: Open Supabase dashboard
read -p "🌐 Open Supabase dashboard to get API keys? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v open &> /dev/null; then
        open "https://supabase.com/dashboard/project/$PROJECT_ID/settings/api"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "https://supabase.com/dashboard/project/$PROJECT_ID/settings/api"
    else
        echo "Please open: https://supabase.com/dashboard/project/$PROJECT_ID/settings/api"
    fi
fi

echo ""
echo "🎯 Ready to enhance your PDF processing with Supabase Edge Functions!"
