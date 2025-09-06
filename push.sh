#!/bin/bash

# GitHubにプッシュするスクリプト
echo "🚀 Pushing to GitHub..."

# 現在のブランチ名を取得
BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "📌 Current branch: $BRANCH"
echo "📦 Latest commit:"
git log -1 --oneline

echo ""
echo "⚠️  手動でプッシュしてください:"
echo ""
echo "1. GitHubにログイン"
echo "2. 以下のコマンドを実行:"
echo ""
echo "   git push origin $BRANCH"
echo ""
echo "または、GitHub Desktop/SourceTreeなどのGUIツールを使用してください。"
echo ""
echo "📝 最新のコミット:"
git log -3 --oneline