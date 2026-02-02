-- ===================================================================
-- TaskMate Stripe連携用テーブル
-- 作成日: 2026-02-02
-- 説明: Stripe Webhook処理に必要なテーブル
-- ===================================================================

-- ===================================================================
-- 1. stripe_events テーブル（Webhookイベント重複防止）
-- ===================================================================
CREATE TABLE IF NOT EXISTS stripe_events (
  id SERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,           -- Stripe Event ID (evt_xxx)
  event_type TEXT NOT NULL,                -- checkout.session.completed, etc.
  processed_at TIMESTAMPTZ DEFAULT NOW(),

  -- メタデータ
  payload JSONB,                           -- イベント全体（デバッグ用）

  -- インデックス
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_events(event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed ON stripe_events(processed_at);

-- ===================================================================
-- 2. refunds テーブル（返金記録）
-- ===================================================================
CREATE TABLE IF NOT EXISTS refunds (
  id SERIAL PRIMARY KEY,
  charge_id TEXT NOT NULL,                 -- Stripe Charge ID (ch_xxx)
  amount INTEGER NOT NULL,                 -- 返金額（円）
  customer_id TEXT,                        -- Stripe Customer ID (cus_xxx)

  -- 理由・メモ
  reason TEXT,                             -- refund reason
  notes TEXT,                              -- 管理者メモ

  -- 関連ユーザー
  user_id TEXT,                            -- LINE User ID（紐付け）

  -- タイムスタンプ
  refunded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_charge ON refunds(charge_id);
CREATE INDEX IF NOT EXISTS idx_refunds_customer ON refunds(customer_id);
CREATE INDEX IF NOT EXISTS idx_refunds_user ON refunds(user_id);

-- ===================================================================
-- 3. usersテーブルへの列追加（ブロック機能用）
-- ===================================================================
-- 注意: 既存のusersテーブルに列を追加
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS unblocked_at TIMESTAMPTZ;

-- カラム追加（エラーを無視して実行）
DO $$
BEGIN
  -- blocked_at 列
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'blocked_at'
  ) THEN
    ALTER TABLE users ADD COLUMN blocked_at TIMESTAMPTZ;
  END IF;

  -- blocked_reason 列
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'blocked_reason'
  ) THEN
    ALTER TABLE users ADD COLUMN blocked_reason TEXT;
  END IF;

  -- unblocked_at 列
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'unblocked_at'
  ) THEN
    ALTER TABLE users ADD COLUMN unblocked_at TIMESTAMPTZ;
  END IF;

  -- stripe_customer_id 列（決済連携用）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
  END IF;

  -- payment_start_date 列（決済サイクル用）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'payment_start_date'
  ) THEN
    ALTER TABLE users ADD COLUMN payment_start_date TIMESTAMPTZ;
  END IF;

  -- last_reset_month 列（月次リセット用）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_reset_month'
  ) THEN
    ALTER TABLE users ADD COLUMN last_reset_month INTEGER DEFAULT 0;
  END IF;

  -- subscription_cancelled_at 列
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'subscription_cancelled_at'
  ) THEN
    ALTER TABLE users ADD COLUMN subscription_cancelled_at TIMESTAMPTZ;
  END IF;

  -- refund_processed_at 列
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'refund_processed_at'
  ) THEN
    ALTER TABLE users ADD COLUMN refund_processed_at TIMESTAMPTZ;
  END IF;
END $$;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_blocked ON users(blocked_at);

-- ===================================================================
-- 4. payment_history テーブル（決済履歴）
-- ===================================================================
CREATE TABLE IF NOT EXISTS payment_history (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,                   -- LINE User ID
  stripe_session_id TEXT,                  -- Checkout Session ID
  stripe_customer_id TEXT,                 -- Customer ID

  -- 決済情報
  amount INTEGER NOT NULL,                 -- 金額（円）
  currency TEXT DEFAULT 'jpy',
  plan_type TEXT,                          -- 'premium', 'professional'

  -- ステータス
  status TEXT DEFAULT 'completed',         -- 'completed', 'refunded', 'failed'

  -- タイムスタンプ
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_history_user ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_customer ON payment_history(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON payment_history(status);

-- ===================================================================
-- Row Level Security
-- ===================================================================
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- 管理者のみアクセス可能
CREATE POLICY "Admin only for stripe_events" ON stripe_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Admin only for refunds" ON refunds
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'service_role');

-- ユーザーは自分の決済履歴のみ閲覧可能
CREATE POLICY "Users can view own payment history" ON payment_history
  FOR SELECT USING (user_id = auth.uid()::text OR auth.jwt() ->> 'role' = 'admin');

-- ===================================================================
-- 完了
-- ===================================================================
