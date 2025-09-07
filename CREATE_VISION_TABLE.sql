-- 1. vision_usageテーブルを作成（これがないと画像認識が動かない！）
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
CREATE INDEX IF NOT EXISTS idx_vision_user_date ON vision_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vision_hash ON vision_usage (image_hash);
CREATE INDEX IF NOT EXISTS idx_vision_created ON vision_usage (created_at DESC);

-- 2. generated_codesテーブルのカラムを確認・修正
-- user_idとsession_idがTEXT型であることを確認
ALTER TABLE generated_codes 
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

ALTER TABLE generated_codes 
ALTER COLUMN session_id TYPE TEXT USING session_id::TEXT;

-- 3. usersテーブルにline_user_idカラムがあるか確認
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS line_user_id TEXT UNIQUE;

-- 4. processing_queueテーブルの修正
ALTER TABLE processing_queue
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

ALTER TABLE processing_queue
ALTER COLUMN session_id TYPE TEXT USING session_id::TEXT;

-- 5. 確認用クエリ（実行後の確認）
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('vision_usage', 'generated_codes', 'users', 'processing_queue')
  AND column_name IN ('user_id', 'session_id', 'line_user_id')
ORDER BY table_name, column_name;