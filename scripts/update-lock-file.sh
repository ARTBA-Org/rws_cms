#!/bin/bash

# Script to update package-lock.json file
# This script helps ensure the package-lock.json file is in sync with package.json

set -e

echo "Updating package-lock.json file"
echo "==============================="
echo "This script will update your package-lock.json file to ensure it's in sync with package.json."
echo ""

# Check if package.json exists
if [ ! -f package.json ]; then
  echo "Error: package.json file not found."
  exit 1
fi

# Remove existing package-lock.json if it exists
if [ -f package-lock.json ]; then
  echo "Removing existing package-lock.json file..."
  rm package-lock.json
fi

# Create .npmrc file if it doesn't exist
if [ ! -f .npmrc ]; then
  echo "Creating .npmrc file..."
  echo "engine-strict=false" > .npmrc
  echo "legacy-peer-deps=true" >> .npmrc
fi

# Run npm install to generate a new package-lock.json
echo "Running npm install to generate a new package-lock.json file..."
npm install --ignore-engines

echo ""
echo "package-lock.json file has been updated successfully!"
echo "You can now commit the changes to your repository."
echo ""
echo "To deploy to AWS Amplify, run:"
echo "./scripts/setup-amplify.sh" 