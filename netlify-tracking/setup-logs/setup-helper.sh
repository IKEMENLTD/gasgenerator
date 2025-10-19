#!/bin/bash

# LINE Channel Unification Setup Helper Script
# このスクリプトは環境変数の設定を支援します

echo "================================================================"
echo "  LINE チャンネル統一 セットアップヘルパー"
echo "================================================================"
echo ""

# ログディレクトリ
LOG_DIR="setup-logs"
LOG_FILE="$LOG_DIR/setup-log-$(date +%Y%m%d_%H%M%S).log"

# ログ関数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "===== セットアップ開始 ====="
echo ""

# STEP 1: Netlify プロジェクトとリンク
echo "STEP 1: Netlify プロジェクトとリンク"
echo "--------------------------------------"
log "STEP 1開始: Netlifyプロジェクトとリンク"

if [ ! -f ".netlify/state.json" ]; then
    echo "⚠️  Netlifyプロジェクトとリンクされていません"
    echo ""
    echo "以下のコマンドを実行してください:"
    echo "  netlify link"
    echo ""
    read -p "リンクが完了したらEnterキーを押してください..."
    log "ユーザーがNetlifyリンクを完了"
else
    echo "✅ Netlifyプロジェクトにリンク済み"
    log "Netlifyプロジェクトにリンク済み"
fi
echo ""

# STEP 2: 現在の環境変数をバックアップ
echo "STEP 2: 現在の環境変数をバックアップ"
echo "--------------------------------------"
log "STEP 2開始: 環境変数バックアップ"

BACKUP_FILE="$LOG_DIR/env-backup-$(date +%Y%m%d_%H%M%S).txt"
netlify env:list > "$BACKUP_FILE" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ バックアップ完了: $BACKUP_FILE"
    log "環境変数バックアップ成功: $BACKUP_FILE"
else
    echo "⚠️  バックアップに失敗しました"
    log "環境変数バックアップ失敗"
fi
echo ""

# STEP 3: 必要な情報を収集
echo "STEP 3: 必要な情報を収集"
echo "--------------------------------------"
log "STEP 3開始: 情報収集"

echo ""
echo "以下の情報を LINE Developers Console から取得してください:"
echo ""
echo "1. LINE Login Channel ID (Messaging APIチャンネルID)"
echo "   場所: LINE Developers Console → Messaging API チャンネル → Basic settings"
echo "   例: 2008021453"
echo ""
read -p "LINE_LOGIN_CHANNEL_ID: " LINE_LOGIN_CHANNEL_ID
log "LINE_LOGIN_CHANNEL_ID入力: $LINE_LOGIN_CHANNEL_ID"

echo ""
echo "2. LINE Login Channel Secret"
echo "   場所: LINE Developers Console → Messaging API チャンネル → LINE Login タブ"
echo "   注意: Messaging API の Channel Secret とは異なります"
echo ""
read -sp "LINE_LOGIN_CHANNEL_SECRET: " LINE_LOGIN_CHANNEL_SECRET
echo ""
log "LINE_LOGIN_CHANNEL_SECRET入力: [REDACTED]"

echo ""
echo "3. LINE Login Callback URL"
echo "   デフォルト: https://taskmateai.net/agency/"
echo ""
read -p "LINE_LOGIN_CALLBACK_URL [https://taskmateai.net/agency/]: " LINE_LOGIN_CALLBACK_URL
LINE_LOGIN_CALLBACK_URL=${LINE_LOGIN_CALLBACK_URL:-https://taskmateai.net/agency/}
log "LINE_LOGIN_CALLBACK_URL入力: $LINE_LOGIN_CALLBACK_URL"

echo ""
echo "4. Messaging API Channel Secret"
echo "   場所: LINE Developers Console → Messaging API チャンネル → Basic settings"
echo ""
read -sp "LINE_CHANNEL_SECRET: " LINE_CHANNEL_SECRET
echo ""
log "LINE_CHANNEL_SECRET入力: [REDACTED]"

echo ""
echo "5. Messaging API Channel Access Token"
echo "   場所: LINE Developers Console → Messaging API チャンネル → Messaging API settings"
echo ""
read -sp "LINE_CHANNEL_ACCESS_TOKEN: " LINE_CHANNEL_ACCESS_TOKEN
echo ""
log "LINE_CHANNEL_ACCESS_TOKEN入力: [REDACTED]"

echo ""
echo "6. LINE公式アカウント友達追加URL"
echo "   場所: LINE Official Account Manager → アカウント設定 → 基本設定"
echo "   形式: https://line.me/R/ti/p/@xxxxxxxxx"
echo ""
read -p "LINE_OFFICIAL_URL: " LINE_OFFICIAL_URL
log "LINE_OFFICIAL_URL入力: $LINE_OFFICIAL_URL"

echo ""
echo "情報収集完了"
echo ""

# STEP 4: 入力内容の確認
echo "STEP 4: 入力内容の確認"
echo "--------------------------------------"
log "STEP 4開始: 入力内容確認"

echo ""
echo "以下の内容で環境変数を設定します:"
echo ""
echo "LINE_LOGIN_CHANNEL_ID:      $LINE_LOGIN_CHANNEL_ID"
echo "LINE_LOGIN_CHANNEL_SECRET:  [HIDDEN]"
echo "LINE_LOGIN_CALLBACK_URL:    $LINE_LOGIN_CALLBACK_URL"
echo "LINE_CHANNEL_SECRET:        [HIDDEN]"
echo "LINE_CHANNEL_ACCESS_TOKEN:  [HIDDEN]"
echo "LINE_OFFICIAL_URL:          $LINE_OFFICIAL_URL"
echo ""

read -p "この内容で設定しますか？ (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "❌ セットアップをキャンセルしました"
    log "セットアップキャンセル"
    exit 1
fi

log "入力内容確認OK"
echo ""

# STEP 5: 環境変数を設定
echo "STEP 5: Netlify 環境変数を設定"
echo "--------------------------------------"
log "STEP 5開始: 環境変数設定"

echo ""
echo "環境変数を設定中..."
echo ""

# LINE_LOGIN_CHANNEL_ID
echo "1/6: LINE_LOGIN_CHANNEL_ID を設定中..."
netlify env:set LINE_LOGIN_CHANNEL_ID "$LINE_LOGIN_CHANNEL_ID" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ✅ 設定成功"
    log "LINE_LOGIN_CHANNEL_ID設定成功"
else
    echo "  ❌ 設定失敗"
    log "LINE_LOGIN_CHANNEL_ID設定失敗"
fi

# LINE_LOGIN_CHANNEL_SECRET
echo "2/6: LINE_LOGIN_CHANNEL_SECRET を設定中..."
netlify env:set LINE_LOGIN_CHANNEL_SECRET "$LINE_LOGIN_CHANNEL_SECRET" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ✅ 設定成功"
    log "LINE_LOGIN_CHANNEL_SECRET設定成功"
else
    echo "  ❌ 設定失敗"
    log "LINE_LOGIN_CHANNEL_SECRET設定失敗"
fi

# LINE_LOGIN_CALLBACK_URL
echo "3/6: LINE_LOGIN_CALLBACK_URL を設定中..."
netlify env:set LINE_LOGIN_CALLBACK_URL "$LINE_LOGIN_CALLBACK_URL" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ✅ 設定成功"
    log "LINE_LOGIN_CALLBACK_URL設定成功"
else
    echo "  ❌ 設定失敗"
    log "LINE_LOGIN_CALLBACK_URL設定失敗"
fi

# LINE_CHANNEL_SECRET
echo "4/6: LINE_CHANNEL_SECRET を設定中..."
netlify env:set LINE_CHANNEL_SECRET "$LINE_CHANNEL_SECRET" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ✅ 設定成功"
    log "LINE_CHANNEL_SECRET設定成功"
else
    echo "  ❌ 設定失敗"
    log "LINE_CHANNEL_SECRET設定失敗"
fi

# LINE_CHANNEL_ACCESS_TOKEN
echo "5/6: LINE_CHANNEL_ACCESS_TOKEN を設定中..."
netlify env:set LINE_CHANNEL_ACCESS_TOKEN "$LINE_CHANNEL_ACCESS_TOKEN" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ✅ 設定成功"
    log "LINE_CHANNEL_ACCESS_TOKEN設定成功"
else
    echo "  ❌ 設定失敗"
    log "LINE_CHANNEL_ACCESS_TOKEN設定失敗"
fi

# LINE_OFFICIAL_URL
echo "6/6: LINE_OFFICIAL_URL を設定中..."
netlify env:set LINE_OFFICIAL_URL "$LINE_OFFICIAL_URL" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ✅ 設定成功"
    log "LINE_OFFICIAL_URL設定成功"
else
    echo "  ❌ 設定失敗"
    log "LINE_OFFICIAL_URL設定失敗"
fi

echo ""
echo "環境変数の設定が完了しました"
log "環境変数設定完了"
echo ""

# STEP 6: 設定内容を確認
echo "STEP 6: 設定内容を確認"
echo "--------------------------------------"
log "STEP 6開始: 設定内容確認"

echo ""
echo "設定された環境変数を確認中..."
echo ""

VERIFY_FILE="$LOG_DIR/env-verify-$(date +%Y%m%d_%H%M%S).txt"
netlify env:list > "$VERIFY_FILE" 2>&1

echo "確認結果を $VERIFY_FILE に保存しました"
log "設定確認完了: $VERIFY_FILE"
echo ""

# LINE関連の環境変数を個別に確認
echo "LINE関連環境変数の確認:"
echo ""

for VAR in LINE_LOGIN_CHANNEL_ID LINE_LOGIN_CHANNEL_SECRET LINE_LOGIN_CALLBACK_URL LINE_CHANNEL_SECRET LINE_CHANNEL_ACCESS_TOKEN LINE_OFFICIAL_URL; do
    VALUE=$(netlify env:get "$VAR" 2>&1)
    if [ $? -eq 0 ] && [ -n "$VALUE" ]; then
        if [[ "$VAR" == *"SECRET"* ]] || [[ "$VAR" == *"TOKEN"* ]]; then
            echo "  ✅ $VAR: [設定済み]"
        else
            echo "  ✅ $VAR: $VALUE"
        fi
        log "$VAR 確認OK"
    else
        echo "  ❌ $VAR: 未設定"
        log "$VAR 確認NG"
    fi
done

echo ""

# STEP 7: デプロイ
echo "STEP 7: サイトを再デプロイ"
echo "--------------------------------------"
log "STEP 7開始: デプロイ"

echo ""
echo "環境変数を反映するには、サイトを再デプロイする必要があります"
echo ""
read -p "今すぐデプロイしますか？ (y/n): " DEPLOY_CONFIRM

if [ "$DEPLOY_CONFIRM" = "y" ] || [ "$DEPLOY_CONFIRM" = "Y" ]; then
    echo ""
    echo "デプロイを開始します..."
    log "デプロイ開始"

    npm run deploy 2>&1 | tee -a "$LOG_FILE"

    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ デプロイ成功"
        log "デプロイ成功"
    else
        echo ""
        echo "❌ デプロイ失敗"
        log "デプロイ失敗"
    fi
else
    echo ""
    echo "⚠️  後でデプロイしてください:"
    echo "  npm run deploy"
    log "デプロイスキップ（手動実行が必要）"
fi

echo ""

# STEP 8: 次のステップ案内
echo "================================================================"
echo "  セットアップ完了"
echo "================================================================"
log "===== セットアップ完了 ====="

echo ""
echo "✅ 環境変数の設定が完了しました"
echo ""
echo "次のステップ:"
echo ""
echo "1. LINE Developers Console でのCallback URL設定を確認"
echo "   - https://developers.line.biz/console/"
echo "   - Messaging API チャンネル → LINE Login タブ"
echo "   - Callback URL: https://taskmateai.net/agency/"
echo ""
echo "2. テスト登録を実施"
echo "   - https://taskmateai.net/agency/"
echo "   - 新規登録からテストアカウントを作成"
echo "   - LINE Login → 友達追加 → メッセージ受信を確認"
echo ""
echo "3. ログを確認"
echo "   - netlify functions:log line-webhook"
echo "   - netlify functions:log agency-complete-registration"
echo ""
echo "詳細は SETUP_CHECKLIST.md を参照してください"
echo ""
echo "ログファイル: $LOG_FILE"
echo ""

log "セットアップヘルパー終了"
