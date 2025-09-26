#!/bin/bash

# TaskMate LINE Tracking System Setup Script

echo "======================================"
echo "TaskMate トラッキングシステム セットアップ"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js version
echo -e "\n${YELLOW}Node.jsバージョンチェック中...${NC}"
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}エラー: Node.js 18以上が必要です${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# Install dependencies
echo -e "\n${YELLOW}依存関係をインストール中...${NC}"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}エラー: npm install が失敗しました${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 依存関係のインストール完了${NC}"

# Create .env.local if not exists
if [ ! -f .env.local ]; then
    echo -e "\n${YELLOW}.env.local ファイルを作成中...${NC}"
    cp .env.example .env.local
    echo -e "${GREEN}✓ .env.local が作成されました${NC}"
    echo -e "${YELLOW}重要: .env.local に必要な環境変数を設定してください${NC}"
else
    echo -e "\n${GREEN}✓ .env.local は既に存在します${NC}"
fi

# Check environment variables
echo -e "\n${YELLOW}環境変数をチェック中...${NC}"
source .env.local 2>/dev/null || true

MISSING_VARS=()

# Check required environment variables
[ -z "$NEXT_PUBLIC_SUPABASE_URL" ] && MISSING_VARS+=("NEXT_PUBLIC_SUPABASE_URL")
[ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ] && MISSING_VARS+=("NEXT_PUBLIC_SUPABASE_ANON_KEY")
[ -z "$SUPABASE_SERVICE_KEY" ] && MISSING_VARS+=("SUPABASE_SERVICE_KEY")
[ -z "$LINE_CHANNEL_SECRET" ] && MISSING_VARS+=("LINE_CHANNEL_SECRET")
[ -z "$LINE_CHANNEL_ACCESS_TOKEN" ] && MISSING_VARS+=("LINE_CHANNEL_ACCESS_TOKEN")
[ -z "$ADMIN_API_KEY" ] && MISSING_VARS+=("ADMIN_API_KEY")
[ -z "$ADMIN_API_SECRET" ] && MISSING_VARS+=("ADMIN_API_SECRET")

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${RED}以下の環境変数が設定されていません:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo -e "${YELLOW}.env.local ファイルを編集して設定してください${NC}"
else
    echo -e "${GREEN}✓ すべての必須環境変数が設定されています${NC}"
fi

# Generate admin credentials if not set
if [ -z "$ADMIN_API_KEY" ] || [ "$ADMIN_API_KEY" == "your-admin-api-key" ]; then
    echo -e "\n${YELLOW}管理者認証情報を生成しますか? (y/n)${NC}"
    read -r GENERATE_ADMIN
    if [ "$GENERATE_ADMIN" == "y" ]; then
        API_KEY=$(openssl rand -hex 16)
        API_SECRET=$(openssl rand -hex 32)
        echo -e "\n${GREEN}生成された認証情報:${NC}"
        echo "ADMIN_API_KEY=$API_KEY"
        echo "ADMIN_API_SECRET=$API_SECRET"
        echo -e "\n${YELLOW}これらを .env.local に追加してください${NC}"
    fi
fi

# Check if Supabase CLI is installed
echo -e "\n${YELLOW}Supabase CLIチェック中...${NC}"
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}Supabase CLIがインストールされていません${NC}"
    echo "インストールしますか? (y/n)"
    read -r INSTALL_SUPABASE
    if [ "$INSTALL_SUPABASE" == "y" ]; then
        npm install -g supabase
    fi
else
    echo -e "${GREEN}✓ Supabase CLI $(supabase --version)${NC}"
fi

# Build test
echo -e "\n${YELLOW}ビルドテストを実行しますか? (y/n)${NC}"
read -r RUN_BUILD
if [ "$RUN_BUILD" == "y" ]; then
    echo -e "${YELLOW}ビルド中...${NC}"
    npm run build
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ ビルド成功${NC}"
    else
        echo -e "${RED}✗ ビルド失敗${NC}"
        exit 1
    fi
fi

echo -e "\n======================================"
echo -e "${GREEN}セットアップ完了！${NC}"
echo -e "======================================"
echo -e "\n次のステップ:"
echo "1. .env.local に環境変数を設定"
echo "2. Supabaseでデータベースセットアップ"
echo "3. npm run dev で開発サーバー起動"
echo -e "\n詳細は DEPLOYMENT_GUIDE.md を参照してください"