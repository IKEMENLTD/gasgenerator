-- Supabaseで実行するマイグレーションスクリプト
-- これをSupabase SQL EditorまたはCLIで実行してください

-- ===================================
-- 1. usersテーブルの修正（既存テーブルがある場合）
-- ===================================

-- line_user_idカラムをTEXT型に変更（UUID制約を削除）
ALTER TABLE users 
ALTER COLUMN line_user_id TYPE TEXT;

-- インデックスの再作成
DROP INDEX IF EXISTS idx_users_line_user_id;
CREATE INDEX idx_users_line_user_id ON users(line_user_id);

-- ===================================
-- 2. Vision API使用履歴テーブル
-- ===================================

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
CREATE INDEX IF NOT EXISTS idx_vision_user_date ON vision_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vision_hash ON vision_usage(image_hash);
CREATE INDEX IF NOT EXISTS idx_vision_created ON vision_usage(created_at DESC);

-- ===================================
-- 3. 月間使用量ビュー（管理用）
-- ===================================

CREATE OR REPLACE VIEW vision_usage_monthly AS
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as total_count,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) * 0.01275 as estimated_cost_usd,
  COUNT(*) * 1.91 as estimated_cost_jpy
FROM vision_usage
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- ===================================
-- 4. 日別使用量ビュー
-- ===================================

CREATE OR REPLACE VIEW vision_usage_daily AS
SELECT 
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as total_count,
  COUNT(DISTINCT user_id) as unique_users
FROM vision_usage
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC
LIMIT 30;

-- ===================================
-- 5. API使用量追跡テーブル（既存の場合はスキップ）
-- ===================================

CREATE TABLE IF NOT EXISTS api_usage (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  request_type VARCHAR(50),
  request_count INTEGER DEFAULT 1,
  estimated_cost DECIMAL(10, 4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_api_usage_user_date ON api_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_type ON api_usage(request_type);

-- ===================================
-- 6. エラーログテーブル（運用監視用）
-- ===================================

CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  error_type VARCHAR(100),
  error_message TEXT,
  stack_trace TEXT,
  user_id TEXT,
  request_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);

-- ===================================
-- 7. ユーザーセッションテーブル（オプション）
-- ===================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_data JSONB,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- ===================================
-- 8. 定期クリーンアップ関数
-- ===================================

-- 古いセッションを削除する関数
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions 
  WHERE expires_at < NOW() OR last_activity < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- 古いエラーログを削除する関数（30日以上）
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM error_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ===================================
-- 確認クエリ
-- ===================================

-- テーブル一覧を確認
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- usersテーブルの構造を確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;