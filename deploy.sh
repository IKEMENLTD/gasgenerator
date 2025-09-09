#!/bin/bash

# デプロイスクリプト
# Renderへの自動デプロイ

echo "🚀 Starting deployment process..."

# 環境変数チェック
if [ -z "$RENDER_API_KEY" ]; then
    echo "⚠️  RENDER_API_KEY is not set"
    echo "Please set it in your environment or .env file"
    exit 1
fi

# ビルドチェック
echo "📦 Running build check..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix errors before deploying."
    exit 1
fi

echo "✅ Build successful"

# 型チェック
echo "🔍 Running type check..."
npm run type-check 2>/dev/null || npm run typecheck 2>/dev/null || npx tsc --noEmit
if [ $? -ne 0 ]; then
    echo "⚠️  Type errors detected but continuing..."
fi

# Renderへのデプロイトリガー
echo "🔄 Triggering Render deployment..."

# Render Service ID (環境変数から取得)
SERVICE_ID=${RENDER_SERVICE_ID:-"srv-ct7a8c3tq21c73a0s340"}

# Render APIを使用してデプロイをトリガー
curl -X POST "https://api.render.com/v1/services/$SERVICE_ID/deploys" \
     -H "Authorization: Bearer $RENDER_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"clearCache": false}'

if [ $? -eq 0 ]; then
    echo "✅ Deployment triggered successfully!"
    echo "🔗 Check deployment status at: https://dashboard.render.com/web/$SERVICE_ID"
    echo ""
    echo "📊 Deployment will take 3-5 minutes"
    echo "🌐 Live URL: https://gasgenerator.onrender.com"
else
    echo "❌ Failed to trigger deployment"
    exit 1
fi

echo ""
echo "✨ Deployment process completed!"