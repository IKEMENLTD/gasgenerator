#!/bin/bash

echo "TaskMate AI 流入経路測定システム - デプロイスクリプト"
echo "========================================"
echo ""

# 環境変数チェック
if [ ! -f .env ]; then
    echo "❌ .envファイルが見つかりません"
    echo "📝 .env.exampleをコピーして環境変数を設定してください"
    echo ""
    echo "cp .env.example .env"
    echo ""
    exit 1
fi

# 必要な環境変数の確認
required_vars=("SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY" "JWT_SECRET")
missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^$var=" .env; then
        missing_vars+=($var)
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ 必要な環境変数が設定されていません："
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "📝 .envファイルを編集して設定してください"
    exit 1
fi

echo "✅ 環境変数チェック完了"
echo ""

# 依存関係のインストール
echo "📦 依存関係をインストール中..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ npm install に失敗しました"
    exit 1
fi
echo "✅ 依存関係のインストール完了"
echo ""

# Netlifyにデプロイ
echo "🚀 Netlifyにデプロイ中..."
netlify deploy --prod
if [ $? -ne 0 ]; then
    echo "❌ デプロイに失敗しました"
    echo ""
    echo "Netlify CLIがインストールされていない場合："
    echo "npm install -g netlify-cli"
    exit 1
fi

echo ""
echo "✅ デプロイ完了！"
echo ""
echo "📋 次のステップ："
echo "1. Netlify管理画面で環境変数を設定"
echo "2. Supabaseでデータベーススキーマを実行"
echo "3. 管理画面にアクセスして動作確認"
echo ""
echo "🔗 URL:"
echo "   管理画面: https://yourdomain.com/admin"
echo "   代理店画面: https://yourdomain.com/agency"