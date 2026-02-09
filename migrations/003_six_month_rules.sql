-- ===================================================================
-- TaskMate 6ヶ月縛りルール & プラン変更用テーブル
-- 作成日: 2026-02-06
-- 説明: 6ヶ月の最低利用期間管理、プラン変更履歴、違約金管理
-- ===================================================================

-- 1. subscriptions テーブルの作成（既存のuser_subscriptionsとは別で管理、または統合）
-- spec_6month_subscription_rules.md に基づき作成

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,                     -- LINE User ID (users table link)
  
  -- 契約情報
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'past_due'
  
  -- 6ヶ月縛り用コアデータ
  contract_start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- 契約起点日（初回課金日）
  
  -- 現在のプラン情報
  current_plan_id VARCHAR(50) NOT NULL DEFAULT 'basic', -- 'basic', 'premium' (String ID)
  current_plan_price INTEGER NOT NULL DEFAULT 10000,
  
  -- 履歴・違約金
  plan_history JSONB DEFAULT '[]'::jsonb,    -- プラン変更履歴
  cancellation_fee_paid BOOLEAN DEFAULT FALSE,
  cancellation_fee_amount INTEGER DEFAULT 0,
  
  -- Stripe連携
  stripe_subscription_id VARCHAR(100),
  stripe_customer_id VARCHAR(100),
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  
  -- タイムスタンプ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 既存の users テーブルからのデータ移行（もしあれば）
-- usersテーブルに stripe_customer_id や subscription_status がある場合、それを元に初期レコードを作成
-- ※ 必要に応じてコメントアウトを解除して実行

/*
INSERT INTO subscriptions (user_id, status, current_plan_id, current_plan_price, stripe_customer_id, contract_start_date)
SELECT 
  line_user_id,
  CASE WHEN subscription_status IN ('premium', 'professional') THEN 'active' ELSE 'cancelled' END,
  CASE 
    WHEN subscription_status = 'professional' THEN 'premium' -- 'professional'プランIDは'premium'として扱うか要確認。一旦premiumとしてマッピング例
    ELSE 'basic' 
  END,
  CASE 
    WHEN subscription_status = 'professional' THEN 50000 
    WHEN subscription_status = 'premium' THEN 10000
    ELSE 10000
  END,
  stripe_customer_id,
  COALESCE(payment_start_date, created_at) -- 起点日はpayment_start_dateがあればそれ、なければ作成日
FROM users
WHERE subscription_status IN ('premium', 'professional')
AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = users.line_user_id);
*/

-- 3. RLSポリシーの設定

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のサブスクリプションのみ閲覧可能
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;
CREATE POLICY "Users can view their own subscriptions"
ON subscriptions
FOR SELECT
USING (auth.uid()::text = user_id OR user_id = current_user); 
-- Note: auth.uid() returns uuid, user_id is text (line id). 
-- If auth.uid() is used for Auth, we need to match it. 
-- Assuming Supabase Auth UID maps to LINE User ID or stored in user_id.
-- If user_id is LINE ID and auth.uid() is Supabase ID, we might need a join or check 'users' table.
-- For simpler implementation often LINE ID is used as primary key or mapped.

-- ユーザーは更新不可（API経由のみ）
DROP POLICY IF EXISTS "Users cannot update subscriptions directly" ON subscriptions;
CREATE POLICY "Users cannot update subscriptions directly"
ON subscriptions
FOR UPDATE
USING (false);

-- Service Role (Server Side) は全操作可能（デフォルトでBypass RLSだが明示的ポリシーは不要）

-- 4. インデックス作成
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_contract_start_date ON subscriptions(contract_start_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id ON subscriptions(stripe_subscription_id);

-- 5. 更新日時トリガー
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
