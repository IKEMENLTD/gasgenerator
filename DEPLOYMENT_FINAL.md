# 🚀 TaskMate Tracking System - Deployment Guide

## ✅ システム準備完了

ビルドが成功し、デプロイの準備が整いました！

## 📋 デプロイ手順

### 1. GitHubへのプッシュ

現在のリポジトリ: `https://github.com/IKEMENLTD/gasgenerator.git`

```bash
# オプション1: 既存のリポジトリにプッシュ（権限が必要）
git push -u origin main

# オプション2: 新しいリポジトリを作成
# 1. GitHub.comで新しいリポジトリを作成
# 2. リモートURLを変更
git remote set-url origin https://github.com/YOUR_USERNAME/gas-generator.git
git push -u origin main
```

### 2. Netlifyでのデプロイ

1. [Netlify](https://app.netlify.com)にログイン
2. "Add new site" → "Import an existing project"をクリック
3. GitHubリポジトリ `gas-generator` を選択
4. ビルド設定:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
   - **Functions directory**: `netlify/functions`

### 3. 環境変数の設定

Netlifyダッシュボード → Site settings → Environment variablesで以下を設定:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# LINE
LINE_CHANNEL_SECRET=your-channel-secret
LINE_CHANNEL_ACCESS_TOKEN=your-channel-access-token
LINE_FRIEND_URL=https://lin.ee/your-line-id
NEXT_PUBLIC_LINE_FRIEND_URL=https://lin.ee/your-line-id

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PAYMENT_LINK=https://buy.stripe.com/xxxxx

# その他
ANTHROPIC_API_KEY=sk-ant-xxxxx
CRON_SECRET=your-secret-key
ADMIN_API_KEY=your-admin-key
ADMIN_API_SECRET=your-admin-secret
```

### 4. Supabaseデータベースの設定

Supabaseダッシュボードで以下のSQLを実行:

```sql
-- /supabase/migrations/001_tracking_tables.sql を実行
-- /supabase/migrations/002_premium_tables.sql を実行
```

### 5. LINE Webhookの設定

LINE Developers Consoleで:
1. Webhook URL: `https://your-domain.netlify.app/api/webhook/line`
2. Webhook利用: ON
3. 応答メッセージ: OFF

## 🎁 プレミアムアクティベーション

### マスターコード（1か月間有効）

```
TASKMATE_PREMIUM_2024_MASTER_ACTIVATION_6B4E2A9F3D8C1B7E5A2F9D4C8B3E7A1D
```

このコードをLINEで送信すると、プレミアムプランが1か月間有効化されます。

### 動作確認

1. トラッキングリンク作成: `/api/admin/links`
2. リンクアクセステスト: `/t/CODE` または `/c/CAMPAIGN`
3. 認証ページ表示確認: `/auth?token=XXXXXX`
4. LINE連携確認: トークンをLINEで送信

## 📊 管理ダッシュボード

- URL: `/admin/dashboard`
- 認証: 環境変数の `ADMIN_API_KEY` と `ADMIN_API_SECRET`

## 🔧 トラブルシューティング

### ビルドエラーの場合

```bash
# 依存関係のクリーンインストール
rm -rf node_modules package-lock.json
npm install

# ビルドテスト
npm run build
```

### 環境変数の確認

```bash
# 必須環境変数のチェック
node -e "require('./lib/config/environment').EnvironmentValidator.validate()"
```

## 📝 追加の設定（オプション）

### カスタムドメイン

1. Netlify → Domain settings
2. Add custom domain
3. DNSレコードを設定

### アナリティクス

1. Netlify Analytics を有効化
2. Google Analytics を追加（必要に応じて）

## ✨ デプロイ完了

以上でTaskMate Tracking Systemのデプロイが完了です！

---

**サポート**: 問題が発生した場合は、エラーログを確認し、環境変数が正しく設定されているか確認してください。