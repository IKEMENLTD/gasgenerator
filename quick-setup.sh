#!/bin/bash

echo "========================================"
echo "🚀 TaskMate クイックセットアップ"
echo "========================================"
echo ""
echo "必要な3つのサービスの情報だけ入力してください。"
echo "セキュリティキーは自動生成されます！"
echo ""

ENV_FILE=".env.local"

# 自動生成されたキーを読み込み
if [ -f /tmp/security_keys.txt ]; then
    source /tmp/security_keys.txt
else
    # キーがなければ生成
    WEBHOOK_SECRET=$(openssl rand -base64 32)
    CRON_SECRET=$(openssl rand -base64 32)
fi

echo "==============================================="
echo "1️⃣ LINE Developers情報"
echo "==============================================="
echo "LINE Developersコンソールで以下を取得："
echo "• Messaging API → Channel access token（長期）"
echo "• Basic settings → Channel secret"
echo ""
read -p "LINE Channel Access Token: " LINE_TOKEN
read -p "LINE Channel Secret: " LINE_SECRET

echo ""
echo "==============================================="
echo "2️⃣ Claude AI情報"
echo "==============================================="
echo "https://console.anthropic.com/ でAPIキーを作成"
echo ""
read -p "Claude/Anthropic API Key: " CLAUDE_KEY

echo ""
echo "==============================================="
echo "3️⃣ Supabase情報"
echo "==============================================="
echo "Supabaseダッシュボード → Settings → API で取得"
echo ""
read -p "Supabase URL (https://xxxxx.supabase.co): " SUPABASE_URL
read -p "Supabase Anon Key (公開キー): " SUPABASE_ANON
read -p "Supabase Service Role Key (秘密キー): " SUPABASE_SERVICE

# .env.localファイル作成
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

# Security (自動生成済み)
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
echo "========================================"
echo "✅ 設定完了！"
echo "========================================"
echo ""
echo "📋 設定された内容："
echo "• LINE設定: OK"
echo "• Claude設定: OK"
echo "• Supabase設定: OK"
echo "• セキュリティキー: 自動生成済み"
echo ""
echo "🔐 生成されたセキュリティキー（Vercelで使用）："
echo "CRON_SECRET=$CRON_SECRET"
echo ""
echo "📝 次のステップ："
echo "1. npm install （パッケージインストール）"
echo "2. Supabaseでデータベース作成"
echo "3. Vercelにデプロイ"
echo ""