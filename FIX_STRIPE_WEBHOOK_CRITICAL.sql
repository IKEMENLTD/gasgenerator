-- =====================================
-- Stripe Webhook 決済処理の致命的バグ修正
-- =====================================
-- 実行日: 2025-01-19
-- 問題: 決済後にプラン変更が反映されない
-- 原因: display_nameでユーザーを検索していた（line_user_idを使うべき）
-- =====================================

-- 1. stripe_eventsテーブルを作成（重複処理防止用）
CREATE TABLE IF NOT EXISTS stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_events(event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_created_at ON stripe_events(created_at);

-- 2. refundsテーブルを作成（返金記録用）
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  customer_id TEXT,
  refunded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_charge_id ON refunds(charge_id);
CREATE INDEX IF NOT EXISTS idx_refunds_customer_id ON refunds(customer_id);

-- 3. usersテーブルに不足しているカラムを追加
-- 注意: これらのカラムが既に存在する場合はエラーになるため、事前確認が必要

-- subscription_cancelled_at列の追加（存在しない場合のみ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name = 'subscription_cancelled_at'
  ) THEN
    ALTER TABLE users ADD COLUMN subscription_cancelled_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- payment_start_date列の追加（存在しない場合のみ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name = 'payment_start_date'
  ) THEN
    ALTER TABLE users ADD COLUMN payment_start_date TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- refund_processed_at列の追加（存在しない場合のみ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name = 'refund_processed_at'
  ) THEN
    ALTER TABLE users ADD COLUMN refund_processed_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- 4. line_user_idにインデックスが存在することを確認（高速検索のため）
CREATE INDEX IF NOT EXISTS idx_users_line_user_id_fast ON users(line_user_id);

-- 5. stripe_customer_idにもインデックスを追加（サブスクキャンセル時の検索高速化）
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

-- =====================================
-- 確認用クエリ
-- =====================================

-- テーブル構造の確認
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- stripe_eventsテーブルの存在確認
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'stripe_events'
) as stripe_events_exists;

-- refundsテーブルの存在確認
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_name = 'refunds'
) as refunds_exists;

-- =====================================
-- 重要な注意事項
-- =====================================
-- 1. このSQLを実行する前に、必ずバックアップを取得してください
-- 2. コード側の修正も必要です：
--    - display_name → line_user_id への変更は既に実装済み
-- 3. Stripeダッシュボードでwebhookエンドポイントが正しく設定されていることを確認
-- 4. STRIPE_WEBHOOK_SECRETが環境変数に正しく設定されていることを確認