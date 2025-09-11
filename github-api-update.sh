#!/bin/bash

echo "🔧 GitHub API経由でファイルを更新"
echo "================================"

# リポジトリ情報
OWNER="IKEMENLTD"
REPO="gasgenerator"
BRANCH="main"

# GitHubトークンをユーザーに入力してもらう
echo "GitHub Personal Access Tokenが必要です。"
echo "トークンの作成方法:"
echo "1. https://github.com/settings/tokens にアクセス"
echo "2. 'Generate new token (classic)' をクリック"
echo "3. 'repo' スコープを選択"
echo "4. トークンをコピー"
echo ""
read -p "GitHub Token を入力してください: " GITHUB_TOKEN

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ トークンが入力されていません"
    exit 1
fi

echo ""
echo "📝 ファイルを更新中..."

# 1. environment.tsのSHAを取得
echo "Getting SHA for environment.ts..."
ENV_SHA=$(curl -s \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$OWNER/$REPO/contents/lib/config/environment.ts?ref=$BRANCH" \
  | grep '"sha"' | cut -d'"' -f4)

echo "SHA: $ENV_SHA"

# 2. environment.tsの内容を準備
ENV_CONTENT=$(cat lib/config/environment.ts | base64 -w 0)

# 3. environment.tsを更新
echo "Updating environment.ts..."
curl -X PUT \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$OWNER/$REPO/contents/lib/config/environment.ts" \
  -d "{
    \"message\": \"Fix: Move ADMIN_API_TOKEN to optional environment variables\",
    \"content\": \"$ENV_CONTENT\",
    \"sha\": \"$ENV_SHA\",
    \"branch\": \"$BRANCH\"
  }" > /tmp/env_update.json

# 4. jwt-manager.tsのSHAを取得
echo "Getting SHA for jwt-manager.ts..."
JWT_SHA=$(curl -s \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$OWNER/$REPO/contents/lib/auth/jwt-manager.ts?ref=$BRANCH" \
  | grep '"sha"' | cut -d'"' -f4)

echo "SHA: $JWT_SHA"

# 5. jwt-manager.tsの内容を準備
JWT_CONTENT=$(cat lib/auth/jwt-manager.ts | base64 -w 0)

# 6. jwt-manager.tsを更新
echo "Updating jwt-manager.ts..."
curl -X PUT \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$OWNER/$REPO/contents/lib/auth/jwt-manager.ts" \
  -d "{
    \"message\": \"Fix: Change ADMIN_API_TOKEN to optional with default value\",
    \"content\": \"$JWT_CONTENT\",
    \"sha\": \"$JWT_SHA\",
    \"branch\": \"$BRANCH\"
  }" > /tmp/jwt_update.json

echo ""
echo "✅ 更新完了！"
echo "📊 確認: https://github.com/$OWNER/$REPO/commits/$BRANCH"
echo "🚀 Renderで自動デプロイが開始されます"