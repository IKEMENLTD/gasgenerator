-- ========================================
-- GAS Generator Complete Database Schema
-- ========================================
-- 実行方法: Supabase Dashboard → SQL Editor で実行
-- 注意: 既存のテーブルがある場合はエラーになるので、必要に応じてDROP TABLEを実行

-- Step 1: usersテーブル作成（存在しない場合）
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_user_id VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  skill_level VARCHAR(50) DEFAULT 'beginner',
  total_requests INTEGER DEFAULT 0,
  last_active_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 2: usersテーブルにサブスクリプション関連カラムを追加
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

-- Step 6: conversation_sessionsテーブル作成
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'active',
  current_step INTEGER DEFAULT 1,
  category VARCHAR(100),
  subcategory VARCHAR(100),
  collected_requirements JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 7: generation_queueテーブル作成
CREATE TABLE IF NOT EXISTS generation_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES conversation_sessions(id),
  line_user_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  retry_count INTEGER DEFAULT 0,
  requirements JSONB NOT NULL,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Step 8: generated_codesテーブル作成
CREATE TABLE IF NOT EXISTS generated_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES conversation_sessions(id),
  queue_job_id UUID REFERENCES generation_queue(id),
  category VARCHAR(100),
  subcategory VARCHAR(100),
  code TEXT NOT NULL,
  summary TEXT,
  explanation TEXT,
  usage_instructions TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 9: metricsテーブル作成
CREATE TABLE IF NOT EXISTS metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_type VARCHAR(100) NOT NULL,
  metric_value NUMERIC,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 10: インデックス追加（追加分）
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id ON conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_status ON conversation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_generation_queue_status ON generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_generation_queue_user_id ON generation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_codes_user_id ON generated_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON metrics(created_at);

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