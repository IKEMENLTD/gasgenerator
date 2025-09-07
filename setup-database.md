# データベースセットアップガイド

## 📋 必要な作業

### 1. Supabaseプロジェクトの作成（まだの場合）

1. [Supabase](https://supabase.com) にアクセス
2. 新規プロジェクトを作成
3. プロジェクトURLとキーを取得

### 2. データベーススキーマの作成

#### 方法A: Supabase Dashboard経由（推奨）

1. Supabaseダッシュボードにログイン
2. SQL Editorタブを開く
3. 以下のSQLを実行：

```sql
-- supabase/migrations/001_initial_schema.sql の内容をコピー＆ペースト
```

#### 方法B: ローカルCLI経由（Dockerが必要）

```bash
# Dockerを起動してから
npx supabase start

# マイグレーション実行
npx supabase db push
```

### 3. 環境変数の設定

`.env.local`ファイルを作成：

```bash
cp .env.local.example .env.local
```

以下の値を設定：

| 環境変数 | 取得場所 |
|---------|---------|
| SUPABASE_URL | Supabase Dashboard > Settings > API |
| SUPABASE_ANON_KEY | Supabase Dashboard > Settings > API |
| SUPABASE_SERVICE_ROLE_KEY | Supabase Dashboard > Settings > API |
| STRIPE_WEBHOOK_SECRET | Stripe Dashboard > Webhooks |
| STRIPE_PRICE_ID | Stripe Dashboard > Products |

### 4. Stripe Webhookの設定

1. Stripe Dashboardにログイン
2. Developers > Webhooks
3. エンドポイントを追加：
   - URL: `https://your-domain.com/api/stripe/webhook`
   - イベント: `checkout.session.completed`, `customer.subscription.deleted`

### 5. 動作確認

```bash
# 開発サーバー起動
npm run dev

# 別ターミナルで
curl http://localhost:3000/api/health
```

## ⚠️ 重要な注意事項

1. **本番環境では必ず環境変数を設定**
   - 未設定だとアプリケーションが起動しません

2. **Stripe Webhook Secretは必須**
   - セキュリティのため、未設定時は全てのWebhookを拒否します

3. **データベースのバックアップ**
   - 本番環境では定期的なバックアップを設定してください

## 🚀 デプロイ準備完了チェックリスト

- [ ] Supabaseプロジェクト作成済み
- [ ] データベーススキーマ作成済み
- [ ] 環境変数設定済み（.env.local）
- [ ] Stripe Webhook設定済み
- [ ] LINE Bot Webhook URL更新済み
- [ ] 動作確認済み

全てチェックできたら本番デプロイ可能です！