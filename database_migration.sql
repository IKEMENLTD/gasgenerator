-- Supabase Database Migration for Payment Integration
-- 実行方法: Supabase Dashboard → SQL Editor で実行

-- Step 1: usersテーブルにサブスクリプション関連カラムを追加
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS monthly_usage_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reset_date DATE DEFAULT CURRENT_DATE;

-- Step 2: 決済履歴テーブル作成
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  stripe_payment_intent_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  amount INTEGER,
  currency VARCHAR(10) DEFAULT 'jpy',
  status VARCHAR(50),
  payment_method VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 3: インデックス追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_created_at ON payment_history(created_at);

-- Step 4: RLS (Row Level Security) ポリシー更新
-- users テーブルのRLSを有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- payment_history テーブルのRLSを有効化
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Step 5: 既存データの初期化（必要に応じて）
UPDATE users 
SET 
  subscription_status = 'free',
  monthly_usage_count = 0,
  last_reset_date = CURRENT_DATE
WHERE subscription_status IS NULL;

-- 確認用クエリ
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM 
  information_schema.columns
WHERE 
  table_name = 'users'
  AND column_name IN (
    'stripe_customer_id',
    'subscription_status',
    'subscription_id',
    'subscription_end_date',
    'monthly_usage_count',
    'last_reset_date'
  );