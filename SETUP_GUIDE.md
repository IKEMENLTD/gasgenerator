# 🚀 セットアップガイド

## 1. 緊急修正完了項目 ✅

### 修正済みのバグ
- [x] `handleFileMessage`の引数不足 → userIdを追加
- [x] `validateSignature`関数未定義 → `validateLineSignature`をインポート

## 2. Supabaseデータベース設定 📊

### 手順1: Supabaseダッシュボードにログイン
1. https://app.supabase.com にアクセス
2. プロジェクトを選択
3. 左メニューから「SQL Editor」を選択

### 手順2: マイグレーションSQL実行
以下のSQLを**順番に**実行してください：

```sql
-- ========================================
-- 1. usersテーブルの修正（重要！）
-- ========================================
-- line_user_idカラムをTEXT型に変更
ALTER TABLE users 
ALTER COLUMN line_user_id TYPE TEXT;

-- インデックスの再作成
DROP INDEX IF EXISTS idx_users_line_user_id;
CREATE INDEX idx_users_line_user_id ON users(line_user_id);
```

```sql
-- ========================================
-- 2. Vision API使用履歴テーブル（必須！）
-- ========================================
CREATE TABLE IF NOT EXISTS vision_usage (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  image_hash TEXT NOT NULL,
  analysis_result TEXT,
  image_size_bytes INTEGER,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_vision_user_date ON vision_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vision_hash ON vision_usage(image_hash);
CREATE INDEX IF NOT EXISTS idx_vision_created ON vision_usage(created_at DESC);
```

```sql
-- ========================================
-- 3. 確認クエリ
-- ========================================
-- テーブルが作成されたか確認
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'vision_usage')
ORDER BY table_name;
```

### 実行確認
上記の確認クエリで以下が表示されればOK：
```
table_name
----------
users
vision_usage
```

## 3. Stripe設定 💳

### 本番キーの取得
1. https://dashboard.stripe.com にログイン
2. 「開発者」→「APIキー」から取得：
   - **公開可能キー**: `pk_live_...`で始まる
   - **シークレットキー**: `sk_live_...`で始まる

### Webhook設定
1. Stripe Dashboard → 「開発者」→「Webhook」
2. 「エンドポイントを追加」
3. エンドポイントURL: `https://gasgenerator.onrender.com/api/stripe/webhook`
4. イベントを選択:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
5. 署名シークレットをコピー: `whsec_...`で始まる

## 4. Render環境変数設定 🔧

Renderダッシュボードで以下を設定：

```env
# LINE設定（既存のまま）
LINE_CHANNEL_ACCESS_TOKEN=（現在の値をそのまま）
LINE_CHANNEL_SECRET=（現在の値をそのまま）

# Claude AI（既存のまま）
ANTHROPIC_API_KEY=（現在の値をそのまま）

# Supabase（既存のまま）
SUPABASE_URL=（現在の値をそのまま）
SUPABASE_SERVICE_ROLE_KEY=（現在の値をそのまま）
SUPABASE_ANON_KEY=（現在の値をそのまま）

# Stripe（新規追加！）
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
STRIPE_PAYMENT_LINK=https://buy.stripe.com/xxxxx

# その他
NODE_ENV=production
WEBHOOK_SECRET=（現在の値をそのまま）
ADMIN_API_TOKEN=（32文字のランダム文字列を生成）
LOG_LEVEL=info
ENABLE_METRICS=true
```

### 環境変数生成ツール
管理者トークン生成（ターミナルで実行）:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 5. デプロイ前の最終確認 ✔️

### チェックリスト
- [ ] Supabaseでマイグレーション実行済み
- [ ] vision_usageテーブルが存在する
- [ ] Stripe本番キーを取得済み
- [ ] Render環境変数を設定済み
- [ ] ADMIN_API_TOKENを生成済み

### 動作テスト
1. LINE Botに「こんにちは」送信 → 返信が来ればOK
2. 画像を送信 → 解析結果が返ればOK
3. 決済リンククリック → Stripeページが開けばOK

## 6. トラブルシューティング 🔧

### エラー: "vision_usage table not found"
→ Supabaseでマイグレーション実行忘れ

### エラー: "Invalid LINE signature"
→ LINE_CHANNEL_SECRETが正しく設定されているか確認

### エラー: "Stripe webhook failed"
→ STRIPE_WEBHOOK_SECRETが正しいか確認

### メモリ使用率が高い
→ Renderの有料プラン（$7/月）にアップグレード推奨

## 7. 運用開始後の監視 📈

### 日次確認
- Renderダッシュボードでメモリ使用率確認
- エラーログ確認

### 月次確認
- Vision API使用数: `/api/admin/vision-stats`
- Stripe売上確認

## 🎉 セットアップ完了！

上記の手順を完了すれば、本番運用可能です。
問題が発生した場合は、`CRITICAL_ISSUES_FINAL.md`を参照してください。