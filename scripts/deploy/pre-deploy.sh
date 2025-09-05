#!/bin/bash

# Pre-deployment script for TaskMate GAS Generator

echo "🚀 TaskMate - Pre-deployment Setup"
echo "================================="

# Check if required files exist
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found. Copy from .env.example:"
    echo "   cp .env.example .env.local"
    echo "   Then edit .env.local with your actual values"
    exit 1
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Run type check
echo "🔍 Running type check..."
npm run type-check

echo "✅ Pre-deployment checks completed successfully!"
echo ""
echo "Next steps:"
echo "1. Ensure all environment variables are set in Vercel"
echo "2. Set up Supabase database using scripts/setup-database.sql"
echo "3. Configure LINE Bot webhook URL after deployment"
echo "4. Deploy with: vercel --prod"