#!/bin/bash

echo "================================"
echo "TaskMate Tracking System Deployment"
echo "================================"

# Check if origin remote exists
if git remote get-url origin &>/dev/null; then
    echo "✅ Remote 'origin' already configured"
    git remote get-url origin
else
    echo "⚠️  No remote 'origin' configured"
    echo ""
    echo "Please create a new repository on GitHub:"
    echo "1. Go to https://github.com/new"
    echo "2. Repository name: gas-generator"
    echo "3. Set as Public or Private"
    echo "4. Do NOT initialize with README, .gitignore, or license"
    echo ""
    echo "Then run:"
    echo "git remote add origin https://github.com/YOUR_USERNAME/gas-generator.git"
    echo ""
    read -p "Have you created the repository? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your GitHub username: " username
        git remote add origin "https://github.com/${username}/gas-generator.git"
        echo "✅ Remote added"
    else
        echo "Please create the repository first"
        exit 1
    fi
fi

echo ""
echo "Pushing to GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "================================"
    echo "Next Steps:"
    echo "================================"
    echo ""
    echo "1. Go to Netlify: https://app.netlify.com"
    echo "2. Click 'Add new site' → 'Import an existing project'"
    echo "3. Connect to GitHub and select 'gas-generator' repository"
    echo "4. Configure build settings:"
    echo "   - Build command: npm run build"
    echo "   - Publish directory: .next"
    echo "   - Functions directory: netlify/functions"
    echo ""
    echo "5. Add environment variables in Netlify:"
    echo "   Copy all variables from .env.local to Netlify's environment settings"
    echo ""
    echo "6. Deploy the site!"
    echo ""
    echo "================================"
    echo "Premium Activation Master Code:"
    echo "================================"
    echo "TASKMATE_PREMIUM_2024_MASTER_ACTIVATION_6B4E2A9F3D8C1B7E5A2F9D4C8B3E7A1D"
    echo ""
    echo "Send this code to LINE to activate premium for 10 years"
    echo "================================"
else
    echo ""
    echo "❌ Push failed. Please check your GitHub credentials"
    echo ""
    echo "If authentication fails, you may need to:"
    echo "1. Create a personal access token at https://github.com/settings/tokens"
    echo "2. Use the token as your password when prompted"
fi