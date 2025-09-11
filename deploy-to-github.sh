#!/bin/bash

echo "🚀 GitHub デプロイスクリプト"
echo "================================"

# GitHubのリポジトリ設定
GITHUB_REPO="IKEMENLTD/gasgenerator"
BRANCH="main"

# 現在のディレクトリを確認
echo "📁 現在のディレクトリ: $(pwd)"

# Gitの状態を確認
echo ""
echo "📊 Git状態確認:"
git status --short

# コミットされていない変更があるか確認
if [[ -n $(git status --porcelain) ]]; then
    echo ""
    echo "⚠️  コミットされていない変更があります"
    echo "コミットしています..."
    git add -A
    git commit -m "Auto-commit: TypeScript fixes for production build $(date +%Y%m%d_%H%M%S)"
fi

# リモートURLを確認
echo ""
echo "🔗 リモートURL確認:"
git remote -v

# 個人用アクセストークンを使用してプッシュ
echo ""
echo "📤 GitHubへプッシュ中..."
echo "================================"

# HTTPSでプッシュ（認証が必要）
if [ -z "$GITHUB_TOKEN" ]; then
    echo "⚠️  GITHUB_TOKEN環境変数が設定されていません"
    echo ""
    echo "以下のコマンドを実行してください:"
    echo ""
    echo "1. GitHub Personal Access Tokenを設定:"
    echo "   export GITHUB_TOKEN=your_github_token_here"
    echo ""
    echo "2. プッシュ:"
    echo "   git push https://\$GITHUB_TOKEN@github.com/$GITHUB_REPO.git $BRANCH"
    echo ""
    echo "または、直接プッシュ:"
    echo "   git push origin $BRANCH"
    echo ""
    echo "================================"
    echo "💡 Tokenの作成方法:"
    echo "1. GitHub.com → Settings → Developer settings → Personal access tokens"
    echo "2. 'Generate new token' をクリック"
    echo "3. 'repo' スコープを選択"
    echo "4. トークンをコピーして上記のコマンドで使用"
else
    # トークンが設定されている場合
    git push https://$GITHUB_TOKEN@github.com/$GITHUB_REPO.git $BRANCH
    
    if [ $? -eq 0 ]; then
        echo "✅ プッシュ成功！"
        echo ""
        echo "🎉 次のステップ:"
        echo "1. Renderのダッシュボードを確認"
        echo "2. 自動デプロイが開始されているか確認"
        echo "3. ビルドログでエラーがないか確認"
    else
        echo "❌ プッシュ失敗"
        echo "手動でプッシュしてください:"
        echo "git push origin $BRANCH"
    fi
fi

echo ""
echo "================================"
echo "📦 Renderデプロイ確認URL:"
echo "https://dashboard.render.com/"
echo "================================"