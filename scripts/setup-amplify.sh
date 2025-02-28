#!/bin/bash

# Script to set up AWS Amplify for RS CMS
# This script helps users set up their AWS Amplify app with the correct configuration

set -e

echo "RS CMS AWS Amplify Setup"
echo "========================"
echo "This script will help you set up your AWS Amplify app for RS CMS."
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "jq is not installed. Please install it first."
    exit 1
fi

# Get AWS Amplify app details
read -p "AWS Amplify App ID: " app_id
read -p "Branch name (default: main): " branch_name
branch_name=${branch_name:-main}

# Set up environment variables
echo "Setting up environment variables..."
./scripts/setup-amplify-env.sh "$app_id" "$branch_name"

# Set up build settings
echo "Setting up build settings..."
aws amplify update-branch \
    --app-id "$app_id" \
    --branch-name "$branch_name" \
    --framework "Next.js - SSR" \
    --stage PRODUCTION \
    --build-spec "$(cat amplify.yml)"

echo ""
echo "AWS Amplify app has been set up successfully!"
echo "You can now deploy your app from the AWS Amplify Console."
echo ""
echo "To set up SSM parameters for enhanced security, run:"
echo "./scripts/setup-ssm-params.sh $app_id $branch_name" 