#!/bin/bash

echo "🔗 GitHubリポジトリと連携します"
echo ""
echo "GitHubで作成したリポジトリのURLを入力してください"
echo "例: https://github.com/YOUR_USERNAME/gas-generator.git"
echo ""
read -p "GitHub リポジトリURL: " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo "❌ URLが入力されていません"
    exit 1
fi

echo ""
echo "📝 リモートリポジトリを設定中..."
git remote add origin "$REPO_URL"

echo "📤 コードをGitHubにプッシュ中..."
git push -u origin main

echo ""
echo "✅ GitHub連携完了！"
echo ""
echo "次のステップ:"
echo "1. Vercelダッシュボード (https://vercel.com) にアクセス"
echo "2. 既存の gas-generator プロジェクトの Settings へ"
echo "3. Git Integration から GitHub リポジトリを接続"
echo "4. これで自動デプロイが有効になります！"