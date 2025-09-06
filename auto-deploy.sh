#!/bin/bash
# Auto deployment script

echo "🚀 Starting automatic deployment..."

# Try to use stored token first
if [ -f ~/.github_token ]; then
    TOKEN=$(cat ~/.github_token)
    echo "Using stored token"
else
    echo "No stored token found"
    # Try environment variable
    if [ -n "$GITHUB_TOKEN" ]; then
        TOKEN=$GITHUB_TOKEN
        echo "Using environment token"
    else
        echo "❌ No GitHub token available"
        echo "Please set GITHUB_TOKEN or create ~/.github_token file"
        exit 1
    fi
fi

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push https://IKEMENLTD:${TOKEN}@github.com/IKEMENLTD/gasgenerator.git main

if [ $? -eq 0 ]; then
    echo "✅ Push successful!"
    echo "⏳ Render will auto-deploy in 3-5 minutes"
    echo ""
    echo "Monitor deployment at:"
    echo "https://dashboard.render.com"
else
    echo "❌ Push failed"
    exit 1
fi