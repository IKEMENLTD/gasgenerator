#!/bin/bash

echo "🚀 GitHub API自動更新スクリプト"
echo "================================"

# リポジトリ情報
OWNER="IKEMENLTD"
REPO="gasgenerator"
BRANCH="main"

# 環境変数からトークンを取得
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN環境変数が設定されていません"
    echo ""
    echo "以下のコマンドでトークンを設定してください:"
    echo "export GITHUB_TOKEN=your_github_token_here"
    echo ""
    echo "トークンの作成方法:"
    echo "1. https://github.com/settings/tokens にアクセス"
    echo "2. 'Generate new token (classic)' をクリック"
    echo "3. 'repo' スコープを選択"
    echo "4. トークンをコピーして上記コマンドで設定"
    exit 1
fi

echo "✅ トークン検出"
echo ""

# ファイル更新関数
update_file() {
    local FILE_PATH=$1
    local COMMIT_MSG=$2
    local LOCAL_FILE=$3
    
    echo "📝 $FILE_PATH を更新中..."
    
    # 現在のファイルのSHAを取得
    RESPONSE=$(curl -s \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/repos/$OWNER/$REPO/contents/$FILE_PATH?ref=$BRANCH")
    
    SHA=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('sha', ''))" 2>/dev/null)
    
    if [ -z "$SHA" ]; then
        echo "⚠️  $FILE_PATH のSHA取得失敗。新規ファイルとして作成します。"
    fi
    
    # ファイル内容をBase64エンコード
    CONTENT=$(base64 -w 0 < "$LOCAL_FILE")
    
    # JSONペイロードを作成
    if [ -z "$SHA" ]; then
        JSON_PAYLOAD="{
            \"message\": \"$COMMIT_MSG\",
            \"content\": \"$CONTENT\",
            \"branch\": \"$BRANCH\"
        }"
    else
        JSON_PAYLOAD="{
            \"message\": \"$COMMIT_MSG\",
            \"content\": \"$CONTENT\",
            \"sha\": \"$SHA\",
            \"branch\": \"$BRANCH\"
        }"
    fi
    
    # ファイルを更新
    RESULT=$(curl -s -X PUT \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/repos/$OWNER/$REPO/contents/$FILE_PATH" \
        -d "$JSON_PAYLOAD")
    
    # 結果確認
    if echo "$RESULT" | grep -q '"commit"'; then
        echo "✅ $FILE_PATH を更新しました"
        return 0
    else
        echo "❌ $FILE_PATH の更新に失敗"
        echo "エラー詳細:"
        echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"
        return 1
    fi
}

# メイン処理
echo "🔄 ファイル更新を開始..."
echo ""

# environment.tsを更新
update_file \
    "lib/config/environment.ts" \
    "Fix: Move ADMIN_API_TOKEN to optional environment variables" \
    "lib/config/environment.ts"

if [ $? -eq 0 ]; then
    # jwt-manager.tsを更新
    update_file \
        "lib/auth/jwt-manager.ts" \
        "Fix: Change ADMIN_API_TOKEN to optional with default value" \
        "lib/auth/jwt-manager.ts"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "================================"
        echo "✅ 全ファイルの更新が完了しました！"
        echo "================================"
        echo ""
        echo "📊 確認: https://github.com/$OWNER/$REPO/commits/$BRANCH"
        echo "🚀 Renderで自動デプロイが開始されます"
        echo "📦 Render Dashboard: https://dashboard.render.com/"
    fi
fi