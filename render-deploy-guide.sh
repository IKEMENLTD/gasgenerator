#!/bin/bash

echo "🚀 Render直接デプロイスクリプト"
echo "================================"

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 必要なファイルの確認
echo -e "${YELLOW}📋 必要なファイルを確認中...${NC}"

required_files=(
    "package.json"
    "next.config.js"
    "tsconfig.json"
    ".env.local"
)

all_files_exist=true
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file が見つかりません${NC}"
        all_files_exist=false
    fi
done

if [ "$all_files_exist" = false ]; then
    echo -e "${RED}必要なファイルが不足しています。中止します。${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔧 ビルドテスト中...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ ビルドに失敗しました${NC}"
    echo "TypeScriptエラーを修正してください"
    exit 1
fi

echo -e "${GREEN}✅ ビルド成功！${NC}"

echo ""
echo "================================"
echo -e "${YELLOW}📦 デプロイ準備完了！${NC}"
echo "================================"
echo ""
echo "次のステップ:"
echo ""
echo -e "${YELLOW}1. GitHubへのプッシュ（自動デプロイ）:${NC}"
echo "   git push origin main"
echo ""
echo -e "${YELLOW}2. Render CLIを使用（手動デプロイ）:${NC}"
echo "   # Render CLIのインストール"
echo "   npm install -g @render/cli"
echo ""
echo "   # ログイン"
echo "   render login"
echo ""
echo "   # デプロイ"
echo "   render deploy"
echo ""
echo -e "${YELLOW}3. Renderダッシュボードから手動デプロイ:${NC}"
echo "   1. https://dashboard.render.com/ にアクセス"
echo "   2. サービスを選択"
echo "   3. 'Manual Deploy' → 'Deploy latest commit' をクリック"
echo ""
echo "================================"
echo -e "${GREEN}修正済みファイルのアーカイブ:${NC}"
echo "   fixed-typescript-code.tar.gz"
echo ""
echo "このファイルには全ての修正が含まれています。"
echo "GitHubに直接アップロードすることも可能です。"
echo "================================"