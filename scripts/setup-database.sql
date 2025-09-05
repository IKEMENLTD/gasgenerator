-- GAS自動生成システム データベース設計
-- 実装ファーストアプローチで必要最小限のテーブルのみ作成

-- 1. users（ユーザーマスタ）
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT UNIQUE NOT NULL,
  display_name TEXT, -- LINEプロフィール名（取得できれば）
  skill_level TEXT DEFAULT 'beginner' CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  total_requests INTEGER DEFAULT 0, -- 利用状況把握用
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_users_line_user_id ON users(line_user_id);
CREATE INDEX idx_users_last_active ON users(last_active_at); -- アクティブユーザー分析用

-- 2. conversation_sessions（会話セッション）
CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ready_for_generation', 'completed', 'abandoned')),
  current_step INTEGER DEFAULT 1,
  category TEXT, -- 'spreadsheet', 'gmail', 'calendar', 'api', 'custom'
  subcategory TEXT, -- カテゴリ内の詳細分類
  collected_requirements JSONB DEFAULT '{}', -- {"step1": "選択値", "step2": "選択値", "details": "詳細入力"}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- パフォーマンス制約
  CONSTRAINT session_age_limit CHECK (created_at > NOW() - INTERVAL '24 hours') -- 24時間で自動削除対象
);

-- インデックス
CREATE INDEX idx_sessions_user_id ON conversation_sessions(user_id);
CREATE INDEX idx_sessions_status ON conversation_sessions(status);
CREATE INDEX idx_sessions_updated_at ON conversation_sessions(updated_at); -- 古いセッション削除用

-- 3. processing_queue（非同期処理キュー）
CREATE TABLE processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  line_user_id TEXT NOT NULL, -- Push送信用（JOIN避けるため非正規化）
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  requirements JSONB NOT NULL, -- 生成に必要な全情報
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0, -- 優先度（通常ユーザー=0, 有料ユーザー=1など）
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- パフォーマンス・運用制約
  CONSTRAINT queue_age_limit CHECK (created_at > NOW() - INTERVAL '1 hour'), -- 1時間で諦める
  CONSTRAINT retry_limit CHECK (retry_count <= max_retries)
);

-- 重要インデックス（処理効率化）
CREATE INDEX idx_queue_status_priority ON processing_queue(status, priority DESC, created_at ASC); -- キュー処理用
CREATE INDEX idx_queue_user_id ON processing_queue(user_id);
CREATE INDEX idx_queue_created_at ON processing_queue(created_at); -- 古いジョブ削除用

-- 4. generated_codes（生成結果）
CREATE TABLE generated_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  requirements_summary TEXT NOT NULL, -- ユーザー要求の要約（検索用）
  generated_code TEXT NOT NULL,
  explanation TEXT NOT NULL,
  usage_steps TEXT[] NOT NULL, -- 使用手順の配列
  code_category TEXT NOT NULL,
  code_subcategory TEXT,
  claude_prompt TEXT NOT NULL, -- デバッグ・改善用
  claude_response_metadata JSONB, -- トークン数、処理時間等
  user_feedback TEXT, -- 'success' | 'error' | 'modified' | null
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス（RAG・分析用）
CREATE INDEX idx_generated_codes_user_id ON generated_codes(user_id, created_at DESC); -- ユーザー履歴取得用
CREATE INDEX idx_generated_codes_category ON generated_codes(code_category, code_subcategory); -- パターン分析用
CREATE INDEX idx_generated_codes_feedback ON generated_codes(user_feedback) WHERE user_feedback IS NOT NULL; -- 成功率分析用

-- 5. claude_usage_logs（Claude API使用量監視）
CREATE TABLE claude_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- ユーザー削除後もログ保持
  request_type TEXT NOT NULL DEFAULT 'code_generation',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10,6) NOT NULL DEFAULT 0, -- ドル単位、小数点以下6桁
  success BOOLEAN NOT NULL,
  error_type TEXT, -- 'rate_limit' | 'timeout' | 'invalid_response' | etc
  processing_time_ms INTEGER, -- 処理時間（ミリ秒）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス（監視・分析用）
CREATE INDEX idx_claude_logs_created_at ON claude_usage_logs(created_at DESC); -- 時系列分析用
CREATE INDEX idx_claude_logs_success ON claude_usage_logs(success, created_at); -- エラー率分析用
CREATE INDEX idx_claude_logs_cost ON claude_usage_logs(created_at, estimated_cost); -- コスト分析用

-- 6. system_metrics（システム監視）
CREATE TABLE system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL, -- 'webhook_response_time' | 'queue_length' | 'daily_requests' | etc
  metric_value DECIMAL(12,4) NOT NULL,
  metadata JSONB, -- 追加情報（エラー詳細など）
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス（監視ダッシュボード用）
CREATE INDEX idx_metrics_type_time ON system_metrics(metric_type, recorded_at DESC);

-- 自動削除トリガー（7日以上古いメトリクスを削除）
CREATE OR REPLACE FUNCTION cleanup_old_metrics() RETURNS trigger AS $$
BEGIN
  DELETE FROM system_metrics WHERE recorded_at < NOW() - INTERVAL '7 days';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_metrics
  AFTER INSERT ON system_metrics
  FOR EACH STATEMENT EXECUTE FUNCTION cleanup_old_metrics();

-- updated_at自動更新
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー設定
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at 
    BEFORE UPDATE ON conversation_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 使用回数自動更新
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

CREATE TRIGGER trigger_increment_requests
    AFTER INSERT ON generated_codes
    FOR EACH ROW EXECUTE FUNCTION increment_user_requests();

-- Row Level Security設定
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_codes ENABLE ROW LEVEL SECURITY;

-- 基本的にはアプリケーションレベルで制御、RLSは補助的に使用
-- ユーザーは自分のデータのみアクセス可能
CREATE POLICY "Users can access own data" ON users
  FOR ALL USING (line_user_id = current_setting('app.current_line_user_id', true));

CREATE POLICY "Sessions access control" ON conversation_sessions
  FOR ALL USING (
    user_id IN (
      SELECT id FROM users 
      WHERE line_user_id = current_setting('app.current_line_user_id', true)
    )
  );

-- 管理者アクセス（Service Role）
CREATE POLICY "Service role full access users" ON users
  FOR ALL USING (current_user = 'service_role');

CREATE POLICY "Service role full access sessions" ON conversation_sessions
  FOR ALL USING (current_user = 'service_role');

CREATE POLICY "Service role full access queue" ON processing_queue
  FOR ALL USING (current_user = 'service_role');

CREATE POLICY "Service role full access codes" ON generated_codes
  FOR ALL USING (current_user = 'service_role');