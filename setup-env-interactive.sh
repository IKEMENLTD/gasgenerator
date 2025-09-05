#!/bin/bash

echo "========================================"
echo "🚀 TaskMate 環境変数セットアップ"
echo "========================================"
echo ""

ENV_FILE=".env.local"

# バックアップ作成
cp $ENV_FILE $ENV_FILE.backup 2>/dev/null

echo "📋 必要な情報を入力してください："
echo ""

# LINE設定
echo "1️⃣ LINE Developers設定"
echo "----------------------------------------"
read -p "LINE Channel Access Token を入力: " LINE_TOKEN
read -p "LINE Channel Secret を入力: " LINE_SECRET

# Claude設定
echo ""
echo "2️⃣ Anthropic Claude設定"
echo "----------------------------------------"
read -p "Claude/Anthropic API Key を入力: " CLAUDE_KEY

# Supabase設定
echo ""
echo "3️⃣ Supabase設定"
echo "----------------------------------------"
read -p "Supabase URL (https://xxxxx.supabase.co): " SUPABASE_URL
read -p "Supabase Anon Key を入力: " SUPABASE_ANON
read -p "Supabase Service Role Key を入力: " SUPABASE_SERVICE

# セキュリティキー生成
echo ""
echo "🔐 セキュリティキーを自動生成中..."
CRON_SECRET=$(openssl rand -base64 32)
WEBHOOK_SECRET=$(openssl rand -base64 32)

# ファイルに書き込み
cat > $ENV_FILE << EOF
# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=$LINE_TOKEN
LINE_CHANNEL_SECRET=$LINE_SECRET

# Claude AI API
CLAUDE_API_KEY=$CLAUDE_KEY
ANTHROPIC_API_KEY=$CLAUDE_KEY

# Supabase
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE

# Security
WEBHOOK_SECRET=$WEBHOOK_SECRET
CRON_SECRET=$CRON_SECRET

# Application Settings
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Monitoring (optional)
LOG_LEVEL=info
ENABLE_METRICS=true
EOF

echo ""
echo "✅ 環境変数の設定が完了しました！"
echo ""
echo "📝 生成されたセキュリティキー："
echo "CRON_SECRET: $CRON_SECRET"
echo "WEBHOOK_SECRET: $WEBHOOK_SECRET"
echo ""
echo "これらは後でVercelにも設定する必要があります。"
echo ""
echo "次のステップ: npm install を実行してください"