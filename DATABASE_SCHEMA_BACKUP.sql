-- ===================================================================
-- TaskMate データベーススキーマ バックアップ
-- 作成日: 2025-10-17
-- 説明: エラー自動修復システム実装前の完全なスキーマ
-- 用途: ロールバック時の復元ポイント
-- ===================================================================

-- ===================================================================
-- 既存テーブル（変更前の状態）
-- ===================================================================

-- 1. users テーブル
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_user_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  picture_url TEXT,
  status_message TEXT,
  language TEXT,

  -- サブスクリプション
  subscription_status VARCHAR(20) DEFAULT 'free', -- 'free', 'premium', 'professional'
  subscription_end_date TIMESTAMP,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- 使用状況
  monthly_usage_count INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  last_active_at TIMESTAMP,
  usage_reset_at TIMESTAMP DEFAULT DATE_TRUNC('month', NOW() + INTERVAL '1 month'),

  -- 流入経路
  referral_tracking_code VARCHAR(50),
  referral_source VARCHAR(50),
  referral_medium VARCHAR(50),
  referral_campaign TEXT,
  referral_confidence NUMERIC(3,2),
  referral_date TIMESTAMP,

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_line_id ON users(line_user_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_referral_source ON users(referral_source);

-- 2. conversation_sessions テーブル
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- セッション情報
  category VARCHAR(50), -- 'spreadsheet', 'gmail', 'calendar', etc.
  requirements JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',

  -- ステータス
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'abandoned'

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_activity_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON conversation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_activity ON conversation_sessions(last_activity_at);

-- 3. conversation_messages テーブル
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  -- メッセージ内容
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant'
  content TEXT NOT NULL,
  message_type VARCHAR(50), -- 'text', 'image', 'quick_reply'

  -- メタデータ
  metadata JSONB DEFAULT '{}',

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON conversation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_user ON conversation_messages(user_id);

-- 4. generated_codes テーブル
CREATE TABLE IF NOT EXISTS generated_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES conversation_sessions(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL,

  -- コード情報
  generated_code TEXT NOT NULL,
  code_category VARCHAR(50),
  explanation TEXT,

  -- Claude情報
  claude_model VARCHAR(50),
  claude_prompt TEXT,
  claude_tokens_used INTEGER,
  generation_time_ms INTEGER,

  -- バリデーション
  validation_score INTEGER,
  validation_issues JSONB,

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_codes_user ON generated_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_codes_session ON generated_codes(session_id);
CREATE INDEX IF NOT EXISTS idx_codes_created ON generated_codes(created_at);

-- 5. generation_queue テーブル
CREATE TABLE IF NOT EXISTS generation_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id UUID,

  -- リクエスト情報
  requirements JSONB NOT NULL,
  category VARCHAR(50),

  -- ステータス
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'

  -- 結果
  result JSONB,
  error_message TEXT,

  -- 処理時間
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- リトライ
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_user ON generation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_created ON generation_queue(created_at);

-- 6. code_shares テーブル
CREATE TABLE IF NOT EXISTS code_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  short_id VARCHAR(10) UNIQUE NOT NULL,

  -- コード情報
  code TEXT NOT NULL,
  title TEXT,
  description TEXT,
  language VARCHAR(20) DEFAULT 'javascript',

  -- 共有情報
  created_by TEXT,
  view_count INTEGER DEFAULT 0,

  -- 有効期限
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shares_short_id ON code_shares(short_id);
CREATE INDEX IF NOT EXISTS idx_shares_active ON code_shares(is_active);

-- 7. vision_analysis テーブル
CREATE TABLE IF NOT EXISTS vision_analysis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id UUID,

  -- 画像情報
  image_hash VARCHAR(64) UNIQUE NOT NULL,
  image_url TEXT,

  -- 解析結果
  analysis_result TEXT NOT NULL,
  confidence_score NUMERIC(3,2),

  -- Claude Vision情報
  model_used VARCHAR(50),
  tokens_used INTEGER,
  processing_time_ms INTEGER,

  -- ステータス
  status VARCHAR(20) DEFAULT 'success', -- 'success', 'failed', 'pending'
  error_message TEXT,

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vision_user ON vision_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_vision_hash ON vision_analysis(image_hash);
CREATE INDEX IF NOT EXISTS idx_vision_created ON vision_analysis(created_at);

-- 8. vision_rate_limits テーブル
CREATE TABLE IF NOT EXISTS vision_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- レート制限
  daily_count INTEGER DEFAULT 0,
  monthly_count INTEGER DEFAULT 0,

  -- リセット日時
  daily_reset_at TIMESTAMP DEFAULT DATE_TRUNC('day', NOW() + INTERVAL '1 day'),
  monthly_reset_at TIMESTAMP DEFAULT DATE_TRUNC('month', NOW() + INTERVAL '1 month'),

  -- タイムスタンプ
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user ON vision_rate_limits(user_id);

-- 9. tracking_links テーブル
CREATE TABLE IF NOT EXISTS tracking_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(6) UNIQUE NOT NULL,

  -- キャンペーン情報
  campaign_name TEXT NOT NULL,
  source VARCHAR(50) NOT NULL,
  medium VARCHAR(50),
  content TEXT,

  -- QRコード
  qr_code_url TEXT,

  -- 統計
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_tracking_links_code ON tracking_links(code);
CREATE INDEX IF NOT EXISTS idx_tracking_links_source ON tracking_links(source);

-- 10. tracking_sessions テーブル
CREATE TABLE IF NOT EXISTS tracking_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_link_id UUID REFERENCES tracking_links(id),

  -- セッション情報
  auth_token VARCHAR(6) NOT NULL,
  tracking_code VARCHAR(50),
  campaign_name TEXT,
  source VARCHAR(50),
  medium VARCHAR(50),

  -- アクセス情報
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  is_mobile BOOLEAN DEFAULT false,

  -- ステータス
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'expired'
  line_user_id TEXT,

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tracking_sessions_token ON tracking_sessions(auth_token);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_status ON tracking_sessions(status);

-- 11. user_states テーブル
CREATE TABLE IF NOT EXISTS user_states (
  user_id TEXT PRIMARY KEY,
  state VARCHAR(50),
  state_data JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 12. support_requests テーブル
CREATE TABLE IF NOT EXISTS support_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id UUID,

  -- リクエスト情報
  request_type VARCHAR(50), -- 'technical', 'feature', 'bug'
  description TEXT NOT NULL,

  -- ステータス
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'resolved'
  assigned_to TEXT,

  -- 解決情報
  resolution TEXT,
  resolved_at TIMESTAMP,

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_user ON support_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_requests(status);

-- ===================================================================
-- ビュー（既存）
-- ===================================================================

-- トラッキング分析ビュー
CREATE OR REPLACE VIEW tracking_analytics AS
SELECT
  l.id,
  l.code,
  l.campaign_name,
  l.source,
  l.medium,
  l.click_count,
  l.conversion_count,
  CASE
    WHEN l.click_count > 0 THEN
      ROUND((l.conversion_count::NUMERIC / l.click_count) * 100, 2)
    ELSE 0
  END as cvr_percentage,
  l.created_at,
  COUNT(DISTINCT s.ip_address) as unique_visitors,
  COUNT(DISTINCT s.line_user_id) as unique_conversions
FROM tracking_links l
LEFT JOIN tracking_sessions s ON l.id = s.tracking_link_id
GROUP BY l.id;

-- ===================================================================
-- RPC関数（既存）
-- ===================================================================

-- クリックカウント増加
CREATE OR REPLACE FUNCTION increment_click_count(link_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE tracking_links
  SET click_count = click_count + 1
  WHERE id = link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- コンバージョンカウント増加
CREATE OR REPLACE FUNCTION increment_conversion(code TEXT)
RETURNS void AS $$
BEGIN
  UPDATE tracking_links
  SET conversion_count = conversion_count + 1
  WHERE code = $1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 月次使用回数リセット
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
  UPDATE users
  SET monthly_usage_count = 0,
      usage_reset_at = DATE_TRUNC('month', NOW() + INTERVAL '1 month')
  WHERE usage_reset_at <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- Row Level Security（既存設定）
-- ===================================================================

-- users テーブル
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own data" ON users
  FOR SELECT
  USING (auth.uid()::text = line_user_id OR auth.jwt() ->> 'role' = 'admin');

-- conversation_sessions テーブル
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions" ON conversation_sessions
  FOR SELECT
  USING (user_id = auth.uid()::text OR auth.jwt() ->> 'role' = 'admin');

-- ===================================================================
-- トリガー（既存）
-- ===================================================================

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON conversation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- 初期データ（サンプル）
-- ===================================================================

-- 管理者ユーザー（必要に応じて）
-- INSERT INTO users (line_user_id, display_name, subscription_status)
-- VALUES ('admin', 'System Admin', 'professional')
-- ON CONFLICT (line_user_id) DO NOTHING;

-- ===================================================================
-- バックアップ検証クエリ
-- ===================================================================

-- テーブル一覧確認
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 各テーブルのレコード数
SELECT
  'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 'conversation_sessions', COUNT(*) FROM conversation_sessions
UNION ALL
SELECT 'generated_codes', COUNT(*) FROM generated_codes
UNION ALL
SELECT 'vision_analysis', COUNT(*) FROM vision_analysis
UNION ALL
SELECT 'tracking_links', COUNT(*) FROM tracking_links;

-- ===================================================================
-- 復元手順
-- ===================================================================

/*
このスキーマから復元する場合:

1. 新規テーブルを全て削除:
   DROP TABLE IF EXISTS error_patterns CASCADE;
   DROP TABLE IF EXISTS error_attempts CASCADE;
   DROP TABLE IF EXISTS user_achievements CASCADE;
   DROP TABLE IF EXISTS success_cases CASCADE;
   DROP TABLE IF EXISTS engineer_support_queue CASCADE;

2. 追加カラムを削除:
   ALTER TABLE users
   DROP COLUMN IF EXISTS skill_level,
   DROP COLUMN IF EXISTS error_rate,
   DROP COLUMN IF EXISTS avg_resolution_time;

3. このファイルを実行:
   psql -h YOUR_HOST -U postgres -d postgres < DATABASE_SCHEMA_BACKUP.sql

4. データをエクスポート/インポート（必要に応じて）
   pg_dump -h YOUR_HOST -U postgres -d postgres -t users > users_backup.sql
   psql -h YOUR_HOST -U postgres -d postgres < users_backup.sql
*/

-- ===================================================================
-- バックアップ完了
-- 作成日: 2025-10-17
-- 次の復元ポイントまで安全に保管してください
-- ===================================================================
