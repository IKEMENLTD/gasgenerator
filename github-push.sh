#!/bin/bash

echo "========================================="
echo "GitHub Push Helper"
echo "========================================="
echo ""

# 環境変数からトークンを読み込む、なければ入力を求める
if [ -z "$GITHUB_TOKEN" ]; then
    echo "GitHub Personal Access Tokenを入力してください:"
    echo "(トークンは https://github.com/settings/tokens から作成できます)"
    echo "(入力時は表示されません)"
    read -s GITHUB_TOKEN
    echo ""
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo "エラー: トークンが入力されていません"
    exit 1
fi

# ユーザー名の取得または入力
GITHUB_USER=${GITHUB_USER:-IKEMENLTD}
echo "GitHubユーザー: $GITHUB_USER"

# 一時的にリモートURLを更新してプッシュ
REPO_URL="https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/IKEMENLTD/gasgenerator.git"

echo "プッシュを実行します..."
git push $REPO_URL main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ プッシュが成功しました！"
    echo ""
    echo "Renderが自動的に再デプロイを開始するはずです。"
    echo "https://dashboard.render.com でデプロイ状況を確認してください。"
else
    echo ""
    echo "❌ プッシュに失敗しました"
    echo ""
    echo "以下を確認してください:"
    echo "1. Personal Access Tokenが正しい"
    echo "2. トークンにrepo権限がある"
    echo "3. ユーザー名が正しい (現在: $GITHUB_USER)"
fi