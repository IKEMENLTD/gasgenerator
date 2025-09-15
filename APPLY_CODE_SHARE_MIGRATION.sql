-- ====================================================================
-- コード共有機能のマイグレーション
-- 実行日: 2025-01-15
-- 目的: 生成されたGASコードを短縮URLで共有する機能の追加
-- ====================================================================

-- 実行前の確認事項:
-- 1. Supabaseダッシュボードにログイン
-- 2. SQL Editorで実行
-- 3. 既存テーブルのバックアップを取得済みであること

-- ========================================
-- STEP 1: code_shares テーブルの作成
-- ========================================
CREATE TABLE IF NOT EXISTS code_shares (
  -- 基本情報
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id VARCHAR(8) UNIQUE NOT NULL,
  version INTEGER DEFAULT 1,

  -- 関連情報（既存テーブルとの連携）
  user_id TEXT NOT NULL,
  job_id TEXT, -- processing_queueのIDと連携可能
  session_id TEXT, -- conversation_sessionsのsession_id_textと連携可能
  parent_id UUID REFERENCES code_shares(id) ON DELETE SET NULL,

  -- コード情報
  title TEXT NOT NULL,
  description TEXT,
  code_content TEXT NOT NULL,
  language VARCHAR(20) DEFAULT 'javascript',
  file_name TEXT DEFAULT 'code.gs',

  -- アクセス設定
  is_public BOOLEAN DEFAULT true,
  password_hash TEXT,
  max_views INTEGER,

  -- メタデータ
  metadata JSONB DEFAULT '{}',
  tags TEXT[],
  conversation_context JSONB,
  requirements JSONB,

  -- 統計情報
  view_count INTEGER DEFAULT 0,
  copy_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMP,

  -- フラグ
  is_premium BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  deletion_reason TEXT,

  -- タイムスタンプ
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- STEP 2: アクセスログテーブルの作成
-- ========================================
CREATE TABLE IF NOT EXISTS code_share_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID REFERENCES code_shares(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  access_type VARCHAR(20),
  device_type VARCHAR(20),
  browser VARCHAR(50),
  os VARCHAR(50),
  accessed_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- STEP 3: 会話関連テーブルの作成
-- ========================================
CREATE TABLE IF NOT EXISTS conversation_code_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_id TEXT,
  share_id UUID REFERENCES code_shares(id) ON DELETE CASCADE,
  relation_type VARCHAR(50),
  context_snapshot JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- STEP 4: ユーザー履歴テーブルの作成
-- ========================================
CREATE TABLE IF NOT EXISTS user_code_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  share_id UUID REFERENCES code_shares(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  action_details JSONB,
  performed_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- STEP 5: インデックスの作成
-- ========================================

-- code_shares用インデックス
CREATE INDEX IF NOT EXISTS idx_code_shares_short_id ON code_shares(short_id);
CREATE INDEX IF NOT EXISTS idx_code_shares_user_id ON code_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_code_shares_expires_at ON code_shares(expires_at) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_code_shares_created_at ON code_shares(created_at);

-- アクセスログ用インデックス
CREATE INDEX IF NOT EXISTS idx_access_logs_share_id ON code_share_access_logs(share_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_accessed_at ON code_share_access_logs(accessed_at);

-- 関連テーブル用インデックス
CREATE INDEX IF NOT EXISTS idx_conv_code_rel_user_id ON conversation_code_relations(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_code_rel_share_id ON conversation_code_relations(share_id);

-- 履歴テーブル用インデックス
CREATE INDEX IF NOT EXISTS idx_user_history_user_id ON user_code_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_history_performed_at ON user_code_history(performed_at DESC);

-- ========================================
-- STEP 6: ヘルパー関数の作成
-- ========================================

-- 短縮ID重複チェック関数
CREATE OR REPLACE FUNCTION check_short_id_exists(p_short_id VARCHAR(8))
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM code_shares WHERE short_id = p_short_id);
END;
$$ LANGUAGE plpgsql;

-- 閲覧回数インクリメント関数
CREATE OR REPLACE FUNCTION increment_view_count(p_short_id VARCHAR(8))
RETURNS void AS $$
BEGIN
  UPDATE code_shares
  SET view_count = view_count + 1,
      last_viewed_at = NOW()
  WHERE short_id = p_short_id
    AND NOT is_deleted;
END;
$$ LANGUAGE plpgsql;

-- コピー回数インクリメント関数
CREATE OR REPLACE FUNCTION increment_copy_count(p_short_id VARCHAR(8))
RETURNS void AS $$
BEGIN
  UPDATE code_shares
  SET copy_count = copy_count + 1
  WHERE short_id = p_short_id
    AND NOT is_deleted;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 7: トリガーの作成
-- ========================================

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_code_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_code_shares_updated_at_trigger
  BEFORE UPDATE ON code_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_code_shares_updated_at();

-- ========================================
-- STEP 8: RLS（Row Level Security）の設定
-- ========================================

-- RLSを有効化
ALTER TABLE code_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_share_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_code_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_code_history ENABLE ROW LEVEL SECURITY;

-- ポリシーの作成
-- 公開コードは誰でも閲覧可能
CREATE POLICY "Public shares are viewable" ON code_shares
  FOR SELECT USING (is_public = true AND NOT is_deleted);

-- アクセスログは誰でも挿入可能
CREATE POLICY "Anyone can log access" ON code_share_access_logs
  FOR INSERT WITH CHECK (true);

-- ユーザーは自分の履歴を閲覧可能
CREATE POLICY "Users view own history" ON user_code_history
  FOR SELECT USING (true); -- アプリケーション層で制御

-- システムは履歴を挿入可能
CREATE POLICY "System can insert history" ON user_code_history
  FOR INSERT WITH CHECK (true);

-- ========================================
-- STEP 9: テーブルコメントの追加
-- ========================================
COMMENT ON TABLE code_shares IS 'Generated GAS codes shared via external URLs';
COMMENT ON COLUMN code_shares.short_id IS 'Unique 8-character ID for short URLs';
COMMENT ON COLUMN code_shares.expires_at IS 'Expiration: 7 days (free), 30 days (premium)';
COMMENT ON TABLE code_share_access_logs IS 'Access tracking for shared codes';
COMMENT ON TABLE conversation_code_relations IS 'Links between conversations and generated codes';
COMMENT ON TABLE user_code_history IS 'User action history for code shares';

-- ========================================
-- STEP 10: 確認用クエリ
-- ========================================

-- テーブルが正しく作成されたか確認
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('code_shares', 'code_share_access_logs', 'conversation_code_relations', 'user_code_history')
ORDER BY table_name;

-- インデックスが作成されたか確認
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('code_shares', 'code_share_access_logs', 'conversation_code_relations', 'user_code_history')
ORDER BY tablename, indexname;

-- ========================================
-- 実行完了メッセージ
-- ========================================
-- すべてのテーブルとインデックスが正常に作成されました。
-- 次のステップ:
-- 1. アプリケーションコードをデプロイ
-- 2. 環境変数NEXT_PUBLIC_BASE_URLを設定
-- 3. 動作確認テストを実施