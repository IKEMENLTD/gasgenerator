-- GAS自動生成システム データベース設計（修正版）
-- Supabase用に最適化

-- 既存テーブルを削除（開発環境のみ）
DROP TABLE IF EXISTS system_metrics CASCADE;
DROP TABLE IF EXISTS claude_usage_logs CASCADE;
DROP TABLE IF EXISTS generated_codes CASCADE;
DROP TABLE IF EXISTS processing_queue CASCADE;
DROP TABLE IF EXISTS conversation_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. users（ユーザーマスタ）
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  skill_level TEXT DEFAULT 'beginner' CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  total_requests INTEGER DEFAULT 0,
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at);

-- 2. conversation_sessions（会話セッション）
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ready_for_generation', 'completed', 'abandoned')),
  current_step INTEGER DEFAULT 1,
  category TEXT,
  subcategory TEXT,
  collected_requirements JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON conversation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON conversation_sessions(updated_at);

-- 3. processing_queue（非同期処理キュー）
CREATE TABLE IF NOT EXISTS processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  line_user_id TEXT NOT NULL,
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  requirements JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_queue_status_priority ON processing_queue(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_queue_user_id ON processing_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_created_at ON processing_queue(created_at);

-- 4. generated_codes（生成結果）
CREATE TABLE IF NOT EXISTS generated_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  requirements_summary TEXT NOT NULL,
  generated_code TEXT NOT NULL,
  explanation TEXT NOT NULL,
  usage_steps TEXT[] NOT NULL,
  code_category TEXT NOT NULL,
  code_subcategory TEXT,
  claude_prompt TEXT NOT NULL,
  claude_response_metadata JSONB,
  user_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_generated_codes_user_id ON generated_codes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_codes_category ON generated_codes(code_category, code_subcategory);
CREATE INDEX IF NOT EXISTS idx_generated_codes_feedback ON generated_codes(user_feedback) WHERE user_feedback IS NOT NULL;

-- 5. claude_usage_logs（Claude API使用量監視）
CREATE TABLE IF NOT EXISTS claude_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL DEFAULT 'code_generation',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10,6) NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL,
  error_type TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_claude_logs_created_at ON claude_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claude_logs_success ON claude_usage_logs(success, created_at);
CREATE INDEX IF NOT EXISTS idx_claude_logs_cost ON claude_usage_logs(created_at, estimated_cost);

-- 6. system_metrics（システム監視）
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  metric_value DECIMAL(12,4) NOT NULL,
  metadata JSONB,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_metrics_type_time ON system_metrics(metric_type, recorded_at DESC);

-- 自動削除関数（古いメトリクスを削除）
CREATE OR REPLACE FUNCTION cleanup_old_metrics() RETURNS trigger AS $$
BEGIN
  DELETE FROM system_metrics WHERE recorded_at < NOW() - INTERVAL '7 days';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- トリガー作成（既存の場合は削除してから作成）
DROP TRIGGER IF EXISTS trigger_cleanup_metrics ON system_metrics;
CREATE TRIGGER trigger_cleanup_metrics
  AFTER INSERT ON system_metrics
  FOR EACH STATEMENT EXECUTE FUNCTION cleanup_old_metrics();

-- updated_at自動更新関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー設定
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON conversation_sessions;
CREATE TRIGGER update_sessions_updated_at 
    BEFORE UPDATE ON conversation_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 使用回数自動更新関数
CREATE OR REPLACE FUNCTION increment_user_requests()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET total_requests = total_requests + 1,
        last_active_at = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_requests ON generated_codes;
CREATE TRIGGER trigger_increment_requests
    AFTER INSERT ON generated_codes
    FOR EACH ROW EXECUTE FUNCTION increment_user_requests();

-- Row Level Security設定（Supabase用に簡略化）
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE claude_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- Service Roleは全アクセス可能（Supabase標準）
CREATE POLICY "Enable all access for service role" ON users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Enable all access for service role" ON conversation_sessions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Enable all access for service role" ON processing_queue
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Enable all access for service role" ON generated_codes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Enable all access for service role" ON claude_usage_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Enable all access for service role" ON system_metrics
  FOR ALL USING (auth.role() = 'service_role');

-- 実行完了メッセージ
DO $$
BEGIN
  RAISE NOTICE 'データベースセットアップが完了しました！';
  RAISE NOTICE '作成されたテーブル: users, conversation_sessions, processing_queue, generated_codes, claude_usage_logs, system_metrics';
END $$;