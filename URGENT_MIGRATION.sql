-- 緊急実行必要なマイグレーション
-- Supabase SQL Editorで実行してください

-- 1. usersテーブルに決済関連カラム追加（存在しない場合のみ）
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP;

-- 2. generation_queueのuser_idをTEXT型に変換（UUID制約削除）
ALTER TABLE generation_queue 
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 3. conversation_sessionsのuser_idをTEXT型に変換
ALTER TABLE conversation_sessions 
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 4. claude_usageのuser_idをTEXT型に変換
ALTER TABLE claude_usage 
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 5. generated_codesのuser_idをTEXT型に変換
ALTER TABLE generated_codes 
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 6. session_idもTEXT型に変換
ALTER TABLE generated_codes 
ALTER COLUMN session_id TYPE TEXT USING session_id::TEXT;

ALTER TABLE conversation_sessions 
ALTER COLUMN id TYPE TEXT USING id::TEXT;

ALTER TABLE generation_queue 
ALTER COLUMN session_id TYPE TEXT USING session_id::TEXT;

-- 7. 外部キー制約を全て削除
ALTER TABLE generation_queue DROP CONSTRAINT IF EXISTS generation_queue_user_id_fkey;
ALTER TABLE conversation_sessions DROP CONSTRAINT IF EXISTS conversation_sessions_user_id_fkey;
ALTER TABLE claude_usage DROP CONSTRAINT IF EXISTS claude_usage_user_id_fkey;
ALTER TABLE generated_codes DROP CONSTRAINT IF EXISTS generated_codes_user_id_fkey;

-- 確認クエリ
SELECT 
  'users' as table_name, 
  COUNT(*) as row_count,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='subscription_status') as has_subscription
FROM users
UNION ALL
SELECT 
  'generation_queue', 
  COUNT(*),
  true
FROM generation_queue;