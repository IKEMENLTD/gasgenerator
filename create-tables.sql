-- ==========================================
-- Create Required Tables for gas-generator
-- ==========================================

-- 1. generation_queueテーブルを作成（存在しない場合）
CREATE TABLE IF NOT EXISTS generation_queue (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  line_user_id TEXT,
  session_id TEXT,
  requirements JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 1,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 2. generation_historyテーブルを作成（存在しない場合）
CREATE TABLE IF NOT EXISTS generation_history (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT,
  requirements_summary TEXT,
  generated_code TEXT,
  explanation TEXT,
  usage_steps TEXT,
  code_category TEXT,
  code_subcategory TEXT,
  claude_prompt TEXT,
  claude_response_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. インデックスを作成
CREATE INDEX IF NOT EXISTS idx_generation_queue_user_id ON generation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_queue_status ON generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_generation_queue_created_at ON generation_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_queue_priority ON generation_queue(priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_generation_history_user_id ON generation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_history_session_id ON generation_history(session_id);
CREATE INDEX IF NOT EXISTS idx_generation_history_created_at ON generation_history(created_at DESC);

-- 4. 更新トリガーを作成（updated_atの自動更新）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_generation_queue_updated_at ON generation_queue;
CREATE TRIGGER update_generation_queue_updated_at
  BEFORE UPDATE ON generation_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. テーブルの存在確認
SELECT 
  'Tables created successfully!' as status,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('generation_queue', 'generation_history')
ORDER BY table_name;

-- 6. サンプルデータを1件挿入（テスト用）
INSERT INTO generation_queue (
  user_id,
  line_user_id,
  session_id,
  requirements,
  status,
  priority
) VALUES (
  'test_user',
  'U1234567890abcdef',
  'session_test_001',
  '{"category": "gmail", "description": "Test requirement"}',
  'pending',
  1
) ON CONFLICT DO NOTHING;

-- 7. データ確認
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM generation_queue;