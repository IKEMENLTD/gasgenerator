#!/bin/bash

# Environment setup script for Vercel deployment

echo "🔧 Setting up Vercel environment variables"
echo "========================================="

# Function to add environment variable to Vercel
add_env() {
    local name=$1
    local desc=$2
    
    echo "Setting $name..."
    echo "Description: $desc"
    read -p "Enter value for $name: " -s value
    echo ""
    
    if [ ! -z "$value" ]; then
        vercel env add $name production <<< "$value"
    else
        echo "⚠️  Skipping $name (empty value)"
    fi
}

# Required environment variables
add_env "LINE_CHANNEL_ACCESS_TOKEN" "LINE Bot channel access token"
add_env "LINE_CHANNEL_SECRET" "LINE Bot channel secret"
add_env "ANTHROPIC_API_KEY" "Claude AI API key"
add_env "SUPABASE_URL" "Supabase project URL"
add_env "SUPABASE_ANON_KEY" "Supabase anonymous key"
add_env "SUPABASE_SERVICE_ROLE_KEY" "Supabase service role key"

# Generate secure secrets
echo "🔐 Generating secure secrets..."

# CRON_SECRET
cron_secret=$(openssl rand -base64 32)
echo "Generated CRON_SECRET: $cron_secret"
vercel env add CRON_SECRET production <<< "$cron_secret"

# JWT_SECRET
jwt_secret=$(openssl rand -base64 32)
echo "Generated JWT_SECRET: $jwt_secret"
vercel env add JWT_SECRET production <<< "$jwt_secret"

# Set application settings
vercel env add NODE_ENV production <<< "production"

echo "✅ Environment setup completed!"
echo ""
echo "🔗 Don't forget to:"
echo "1. Update LINE Bot webhook URL after deployment"
echo "2. Test the webhook endpoint"
echo "3. Monitor logs and metrics"