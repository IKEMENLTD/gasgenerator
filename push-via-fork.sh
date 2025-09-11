#!/bin/bash

echo "🔄 Fork経由でのプッシュスクリプト"
echo "================================"

# 現在の変更を保存
echo "📦 変更を保存中..."
git stash

# 新しいブランチを作成
BRANCH_NAME="fix-admin-token-$(date +%Y%m%d-%H%M%S)"
echo "🌿 新しいブランチを作成: $BRANCH_NAME"
git checkout -b $BRANCH_NAME

# stashした変更を適用
git stash pop

# コミット
echo "📝 コミット中..."
git add -A
git commit -m "Fix ADMIN_API_TOKEN environment variable error

- Move ADMIN_API_TOKEN from required to optional environment variables
- Change getRequired to getOptional with default value in jwt-manager.ts
- This fixes Render deployment error"

# プッシュを試みる
echo "🚀 プッシュを試みています..."
git push origin $BRANCH_NAME 2>&1

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ 直接プッシュできません"
    echo ""
    echo "================================"
    echo "📋 手動でのプッシュ手順:"
    echo "================================"
    echo ""
    echo "1. GitHubでリポジトリをフォーク:"
    echo "   https://github.com/IKEMENLTD/gasgenerator"
    echo ""
    echo "2. フォークしたリポジトリをクローン:"
    echo "   git clone https://github.com/YOUR_USERNAME/gasgenerator.git"
    echo ""
    echo "3. 変更をコピー:"
    echo "   以下のファイルをコピー:"
    echo "   - lib/config/environment.ts"
    echo "   - lib/auth/jwt-manager.ts"
    echo ""
    echo "4. コミット&プッシュ:"
    echo "   git add -A"
    echo "   git commit -m 'Fix ADMIN_API_TOKEN error'"
    echo "   git push origin main"
    echo ""
    echo "5. プルリクエストを作成:"
    echo "   フォークしたリポジトリからオリジナルへPRを作成"
else
    echo "✅ プッシュ成功！"
    echo ""
    echo "次のステップ:"
    echo "1. https://github.com/IKEMENLTD/gasgenerator にアクセス"
    echo "2. Pull Requestを作成"
    echo "3. マージ後、Renderが自動デプロイ"
fi

echo ""
echo "================================"
echo "📦 修正済みファイル:"
echo "================================"
echo "1. lib/config/environment.ts"
echo "2. lib/auth/jwt-manager.ts"
echo ""
echo "これらのファイルには全ての修正が含まれています。"