-- ==========================================
-- Fix Missing Columns in Database
-- ==========================================

-- 1. generation_queueテーブルにuser_idカラムを追加
ALTER TABLE generation_queue 
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 2. generation_queueテーブルにrequirementsカラムを追加
ALTER TABLE generation_queue 
ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '{}';

-- 3. usersテーブルにline_user_idカラムを追加
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS line_user_id TEXT UNIQUE;

-- 4. conversation_statesテーブルにuser_idカラムを追加
ALTER TABLE conversation_states 
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 5. conversation_statesテーブルにsession_idカラムを追加
ALTER TABLE conversation_states 
ADD COLUMN IF NOT EXISTS session_id TEXT;

-- 6. conversation_statesテーブルにconversation_stateカラムを追加
ALTER TABLE conversation_states 
ADD COLUMN IF NOT EXISTS conversation_state JSONB DEFAULT '{}';

-- 7. generated_codesテーブルに必要なカラムを追加
ALTER TABLE generated_codes 
ADD COLUMN IF NOT EXISTS user_id TEXT,
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS requirements_summary TEXT,
ADD COLUMN IF NOT EXISTS generated_code TEXT,
ADD COLUMN IF NOT EXISTS explanation TEXT,
ADD COLUMN IF NOT EXISTS usage_steps TEXT,
ADD COLUMN IF NOT EXISTS code_category TEXT,
ADD COLUMN IF NOT EXISTS claude_prompt TEXT;

-- 8. processing_queueテーブルに必要なカラムを追加
ALTER TABLE processing_queue 
ADD COLUMN IF NOT EXISTS user_id TEXT,
ADD COLUMN IF NOT EXISTS line_user_id TEXT,
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '{}';

-- 9. conversation_sessionsテーブルに必要なカラムを追加
ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS user_id TEXT,
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS line_user_id TEXT,
ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]';

-- 10. 既存のNULL値を更新
UPDATE generation_queue 
SET user_id = COALESCE(line_user_id, 'unknown') 
WHERE user_id IS NULL;

UPDATE users 
SET line_user_id = 'U' || REPLACE(CAST(id AS TEXT), '-', '') 
WHERE line_user_id IS NULL;

UPDATE conversation_states 
SET user_id = 'unknown' 
WHERE user_id IS NULL;

UPDATE generated_codes 
SET user_id = 'unknown' 
WHERE user_id IS NULL;

UPDATE processing_queue 
SET user_id = 'unknown' 
WHERE user_id IS NULL;

-- 11. NOT NULL制約を追加（重要なカラムのみ）
ALTER TABLE generation_queue 
ALTER COLUMN user_id SET NOT NULL;

-- 12. デフォルト値を設定
ALTER TABLE generation_queue 
ALTER COLUMN status SET DEFAULT 'pending',
ALTER COLUMN retry_count SET DEFAULT 0,
ALTER COLUMN priority SET DEFAULT 1,
ALTER COLUMN max_retries SET DEFAULT 3;

-- 13. インデックスを作成
CREATE INDEX IF NOT EXISTS idx_generation_queue_user_id ON generation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_queue_line_user_id ON generation_queue(line_user_id);
CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_user_id ON processing_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_codes_user_id ON generated_codes(user_id);

-- 14. 確認クエリ
SELECT 
  'Columns added successfully!' as status;

-- 15. generation_queueの構造を確認
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'generation_queue'
ORDER BY ordinal_position;

-- 16. テストデータを挿入
INSERT INTO generation_queue (
  user_id,
  line_user_id,
  session_id,
  requirements,
  status,
  priority
) VALUES (
  'test_user_001',
  'U1234567890abcdef',
  gen_random_uuid(),
  '{"category": "gmail", "description": "Test requirement for Gmail automation"}',
  'pending',
  1
);

-- 17. データ確認
SELECT 
  id,
  user_id,
  line_user_id,
  status,
  created_at
FROM generation_queue
ORDER BY created_at DESC
LIMIT 5;