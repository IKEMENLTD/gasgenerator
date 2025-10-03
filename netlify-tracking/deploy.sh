#!/bin/bash

# TaskMate AI Tracking System - Deployment Script
echo "🚀 Deploying TaskMate AI Tracking System..."

# Check if required files exist
echo "📋 Checking required files..."

required_files=(
    "admin/index.html"
    "admin/dashboard.js"
    "t/index.html"
    "netlify/functions/create-tracking-link.js"
    "netlify/functions/get-tracking-stats.js"
    "netlify/functions/track-visit.js"
    "netlify/functions/line-webhook.js"
    "netlify.toml"
    "package.json"
    "supabase-schema.sql"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file - MISSING!"
        exit 1
    fi
done

# Check if package.json is valid
echo "📦 Validating package.json..."
if node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))" 2>/dev/null; then
    echo "✅ package.json is valid"
else
    echo "❌ package.json is invalid!"
    exit 1
fi

# Check if netlify.toml is valid
echo "⚙️ Validating netlify.toml..."
if [ -f "netlify.toml" ]; then
    echo "✅ netlify.toml exists"
else
    echo "❌ netlify.toml missing!"
    exit 1
fi

# Install dependencies
echo "📥 Installing dependencies..."
npm install

# Create deployment info
echo "📝 Creating deployment info..."
cat > deployment-info.txt << EOF
TaskMate AI Tracking System Deployment
=====================================

Deployment Date: $(date)
Files Created: ${#required_files[@]}

Admin Dashboard: https://your-domain.netlify.app/admin
Tracking Links: https://your-domain.netlify.app/t/{tracking_code}

Required Environment Variables:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- LINE_CHANNEL_SECRET
- LINE_CHANNEL_ACCESS_TOKEN
- ADMIN_USERNAME
- ADMIN_PASSWORD
- DEFAULT_LINE_FRIEND_URL

Next Steps:
1. Set up Supabase database with supabase-schema.sql
2. Configure LINE Bot webhook
3. Set environment variables in Netlify
4. Deploy to Netlify
5. Test tracking links and admin dashboard

EOF

echo "✨ Deployment preparation complete!"
echo "📄 Check deployment-info.txt for next steps"

# Optional: Deploy to Netlify if CLI is available
if command -v netlify &> /dev/null; then
    echo "🌐 Netlify CLI detected. Deploy now? (y/n)"
    read -r deploy_now
    if [ "$deploy_now" = "y" ] || [ "$deploy_now" = "Y" ]; then
        echo "🚀 Deploying to Netlify..."
        netlify deploy --prod
    fi
else
    echo "💡 Install Netlify CLI to deploy directly: npm install -g netlify-cli"
fi

echo "🎉 Ready for deployment!"