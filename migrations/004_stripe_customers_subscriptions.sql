-- ===================================================================
-- TaskMate Stripe顧客・サブスクリプションテーブル
-- 作成日: 2026-02-09
-- 説明: Stripe連携に必要な顧客・サブスクリプション管理テーブル
-- ===================================================================

-- ===================================================================
-- 1. stripe_customers テーブル（Stripe顧客情報）
-- ===================================================================
CREATE TABLE IF NOT EXISTS stripe_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Stripe情報
  stripe_customer_id TEXT UNIQUE NOT NULL,     -- Stripe Customer ID (cus_xxx)
  
  -- ユーザー紐付け
  user_id TEXT NOT NULL,                       -- LINE User ID
  email TEXT,                                  -- 顧客メールアドレス
  
  -- 顧客情報
  name TEXT,                                   -- 顧客名
  phone TEXT,                                  -- 電話番号
  
  -- メタデータ
  metadata JSONB DEFAULT '{}',                 -- 追加情報
  
  -- Stripe上のステータス
  stripe_created_at TIMESTAMPTZ,               -- Stripe上での作成日時
  
  -- タイムスタンプ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_id ON stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_email ON stripe_customers(email);

-- ===================================================================
-- 2. stripe_subscriptions テーブル（Stripeサブスクリプション情報）
-- ===================================================================
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Stripe情報
  stripe_subscription_id TEXT UNIQUE NOT NULL, -- Stripe Subscription ID (sub_xxx)
  stripe_customer_id TEXT NOT NULL,            -- Stripe Customer ID (cus_xxx)
  
  -- ユーザー紐付け
  user_id TEXT NOT NULL,                       -- LINE User ID
  
  -- サブスクリプション情報
  status TEXT NOT NULL,                        -- 'active', 'canceled', 'incomplete', 'past_due', 'trialing', 'unpaid'
  plan_type TEXT,                              -- 'basic', 'professional'
  
  -- 価格情報
  stripe_price_id TEXT,                        -- Stripe Price ID (price_xxx)
  amount INTEGER,                              -- 金額（円）
  currency TEXT DEFAULT 'jpy',                 -- 通貨
  interval TEXT,                               -- 'month', 'year'
  
  -- 期間情報
  current_period_start TIMESTAMPTZ,            -- 現在の請求期間開始日
  current_period_end TIMESTAMPTZ,              -- 現在の請求期間終了日
  trial_start TIMESTAMPTZ,                     -- トライアル開始日
  trial_end TIMESTAMPTZ,                       -- トライアル終了日
  
  -- キャンセル情報
  cancel_at_period_end BOOLEAN DEFAULT false,  -- 期間終了時にキャンセルするか
  canceled_at TIMESTAMPTZ,                     -- キャンセル日時
  cancellation_reason TEXT,                    -- キャンセル理由
  
  -- 6ヶ月縛りルール用
  contract_start_date TIMESTAMPTZ,             -- 契約開始日
  minimum_contract_months INTEGER DEFAULT 6,   -- 最低契約期間（月）
  early_cancellation_fee INTEGER,              -- 違約金（円）
  
  -- メタデータ
  metadata JSONB DEFAULT '{}',                 -- 追加情報
  
  -- Stripe上のステータス
  stripe_created_at TIMESTAMPTZ,               -- Stripe上での作成日時
  
  -- タイムスタンプ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_stripe_id ON stripe_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_customer_id ON stripe_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_user_id ON stripe_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_status ON stripe_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_period_end ON stripe_subscriptions(current_period_end);

-- ===================================================================
-- 3. 外部キー制約（オプション）
-- ===================================================================
-- stripe_subscriptions から stripe_customers への参照
-- 注: Stripe IDベースなので、UUIDではなくTEXTで紐付け
ALTER TABLE stripe_subscriptions
  DROP CONSTRAINT IF EXISTS fk_stripe_subscriptions_customer;

ALTER TABLE stripe_subscriptions
  ADD CONSTRAINT fk_stripe_subscriptions_customer
  FOREIGN KEY (stripe_customer_id)
  REFERENCES stripe_customers(stripe_customer_id)
  ON DELETE CASCADE;

-- ===================================================================
-- 4. RPC関数: Stripe顧客情報の取得・作成
-- ===================================================================
CREATE OR REPLACE FUNCTION get_or_create_stripe_customer(
  p_user_id TEXT,
  p_stripe_customer_id TEXT,
  p_email TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  -- 既存の顧客を検索
  SELECT id INTO v_customer_id
  FROM stripe_customers
  WHERE stripe_customer_id = p_stripe_customer_id;
  
  -- 存在しない場合は作成
  IF v_customer_id IS NULL THEN
    INSERT INTO stripe_customers (
      stripe_customer_id,
      user_id,
      email,
      name,
      stripe_created_at
    ) VALUES (
      p_stripe_customer_id,
      p_user_id,
      p_email,
      p_name,
      NOW()
    )
    RETURNING id INTO v_customer_id;
  ELSE
    -- 既存の場合は情報を更新
    UPDATE stripe_customers
    SET user_id = p_user_id,
        email = COALESCE(p_email, email),
        name = COALESCE(p_name, name),
        updated_at = NOW()
    WHERE id = v_customer_id;
  END IF;
  
  RETURN v_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- 5. RPC関数: Stripeサブスクリプション情報の取得・更新
-- ===================================================================
CREATE OR REPLACE FUNCTION upsert_stripe_subscription(
  p_stripe_subscription_id TEXT,
  p_stripe_customer_id TEXT,
  p_user_id TEXT,
  p_status TEXT,
  p_plan_type TEXT DEFAULT NULL,
  p_stripe_price_id TEXT DEFAULT NULL,
  p_amount INTEGER DEFAULT NULL,
  p_currency TEXT DEFAULT 'jpy',
  p_interval TEXT DEFAULT NULL,
  p_current_period_start TIMESTAMPTZ DEFAULT NULL,
  p_current_period_end TIMESTAMPTZ DEFAULT NULL,
  p_cancel_at_period_end BOOLEAN DEFAULT false,
  p_canceled_at TIMESTAMPTZ DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_subscription_id UUID;
  v_contract_start TIMESTAMPTZ;
BEGIN
  -- 既存のサブスクリプションを検索
  SELECT id, contract_start_date INTO v_subscription_id, v_contract_start
  FROM stripe_subscriptions
  WHERE stripe_subscription_id = p_stripe_subscription_id;
  
  -- 契約開始日の決定（新規の場合は現在時刻、既存の場合は保持）
  IF v_contract_start IS NULL THEN
    v_contract_start := COALESCE(p_current_period_start, NOW());
  END IF;
  
  -- 存在しない場合は作成、存在する場合は更新
  INSERT INTO stripe_subscriptions (
    stripe_subscription_id,
    stripe_customer_id,
    user_id,
    status,
    plan_type,
    stripe_price_id,
    amount,
    currency,
    interval,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    canceled_at,
    contract_start_date,
    metadata,
    stripe_created_at
  ) VALUES (
    p_stripe_subscription_id,
    p_stripe_customer_id,
    p_user_id,
    p_status,
    p_plan_type,
    p_stripe_price_id,
    p_amount,
    p_currency,
    p_interval,
    p_current_period_start,
    p_current_period_end,
    p_cancel_at_period_end,
    p_canceled_at,
    v_contract_start,
    p_metadata,
    NOW()
  )
  ON CONFLICT (stripe_subscription_id) DO UPDATE SET
    status = EXCLUDED.status,
    plan_type = COALESCE(EXCLUDED.plan_type, stripe_subscriptions.plan_type),
    stripe_price_id = COALESCE(EXCLUDED.stripe_price_id, stripe_subscriptions.stripe_price_id),
    amount = COALESCE(EXCLUDED.amount, stripe_subscriptions.amount),
    currency = EXCLUDED.currency,
    interval = COALESCE(EXCLUDED.interval, stripe_subscriptions.interval),
    current_period_start = COALESCE(EXCLUDED.current_period_start, stripe_subscriptions.current_period_start),
    current_period_end = COALESCE(EXCLUDED.current_period_end, stripe_subscriptions.current_period_end),
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    canceled_at = EXCLUDED.canceled_at,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO v_subscription_id;
  
  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- 6. RPC関数: アクティブなサブスクリプション取得
-- ===================================================================
CREATE OR REPLACE FUNCTION get_active_subscription(p_user_id TEXT)
RETURNS TABLE (
  subscription_id UUID,
  stripe_subscription_id TEXT,
  status TEXT,
  plan_type TEXT,
  amount INTEGER,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN,
  contract_start_date TIMESTAMPTZ,
  months_elapsed INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.id,
    ss.stripe_subscription_id,
    ss.status,
    ss.plan_type,
    ss.amount,
    ss.current_period_end,
    ss.cancel_at_period_end,
    ss.contract_start_date,
    EXTRACT(MONTH FROM AGE(NOW(), ss.contract_start_date))::INTEGER as months_elapsed
  FROM stripe_subscriptions ss
  WHERE ss.user_id = p_user_id
    AND ss.status IN ('active', 'trialing')
  ORDER BY ss.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- 7. Row Level Security
-- ===================================================================
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;

-- stripe_customers: ユーザーは自分の顧客情報のみ閲覧可能
DROP POLICY IF EXISTS "Users can view own stripe customer" ON stripe_customers;
CREATE POLICY "Users can view own stripe customer" ON stripe_customers
  FOR SELECT USING (user_id = auth.uid()::text OR auth.jwt() ->> 'role' = 'admin');

-- stripe_subscriptions: ユーザーは自分のサブスクリプション情報のみ閲覧可能
DROP POLICY IF EXISTS "Users can view own stripe subscription" ON stripe_subscriptions;
CREATE POLICY "Users can view own stripe subscription" ON stripe_subscriptions
  FOR SELECT USING (user_id = auth.uid()::text OR auth.jwt() ->> 'role' = 'admin');

-- 管理者・サービスロールは全アクセス可能
DROP POLICY IF EXISTS "Service role full access to stripe_customers" ON stripe_customers;
CREATE POLICY "Service role full access to stripe_customers" ON stripe_customers
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access to stripe_subscriptions" ON stripe_subscriptions;
CREATE POLICY "Service role full access to stripe_subscriptions" ON stripe_subscriptions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ===================================================================
-- 8. トリガー: updated_at自動更新
-- ===================================================================
DROP TRIGGER IF EXISTS update_stripe_customers_updated_at ON stripe_customers;
CREATE TRIGGER update_stripe_customers_updated_at
  BEFORE UPDATE ON stripe_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stripe_subscriptions_updated_at ON stripe_subscriptions;
CREATE TRIGGER update_stripe_subscriptions_updated_at
  BEFORE UPDATE ON stripe_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- 完了
-- ===================================================================
-- このマイグレーションにより、以下のテーブルが作成されます：
-- ✅ stripe_customers (Stripe顧客情報)
-- ✅ stripe_subscriptions (Stripeサブスクリプション情報)
--
-- 実行後、Supabase Table Editorで確認してください。
-- ===================================================================
