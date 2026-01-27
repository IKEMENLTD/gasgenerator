-- ===================================================================
-- TaskMate 新料金プラン・RAGシステム用テーブル
-- 作成日: 2026-01-27
-- 説明: サブスクリプション管理、システムカタログ、RAG用テーブル
-- ===================================================================

-- pgvector拡張を有効化（Supabaseで事前に有効化が必要）
-- CREATE EXTENSION IF NOT EXISTS vector;

-- ===================================================================
-- 1. subscription_plans テーブル（サブスクリプションプラン定義）
-- ===================================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,          -- 'basic', 'professional'
  display_name VARCHAR(100) NOT NULL,        -- '1万円プラン', '5万円プラン'
  price_monthly INTEGER NOT NULL,            -- 10000, 50000 (円)
  contract_months INTEGER NOT NULL DEFAULT 6, -- 契約期間（月）

  -- システム閲覧・ダウンロード制限
  viewable_systems INTEGER,                  -- 閲覧可能システム数（NULL=無制限）
  monthly_downloads INTEGER NOT NULL,        -- 月間DL上限

  -- サポート
  free_support_sessions INTEGER DEFAULT 0,   -- 月間無料サポート回数
  support_price INTEGER DEFAULT 10000,       -- 追加サポート料金（円）

  -- Stripe連携
  stripe_price_id VARCHAR(100),

  -- 状態
  is_active BOOLEAN DEFAULT true,

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 初期プランデータ
INSERT INTO subscription_plans (name, display_name, price_monthly, contract_months, viewable_systems, monthly_downloads, free_support_sessions, support_price)
VALUES
  ('basic', '1万円プラン', 10000, 6, 3, 1, 0, 10000),
  ('professional', '5万円プラン', 50000, 6, NULL, 5, 1, 0)
ON CONFLICT (name) DO NOTHING;

-- ===================================================================
-- 2. user_subscriptions テーブル（ユーザーのサブスク状態）
-- ===================================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,                     -- LINE User ID
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),

  -- 契約情報
  status VARCHAR(20) DEFAULT 'active',       -- 'active', 'cancelled', 'expired', 'pending'
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,             -- 契約終了日
  cancelled_at TIMESTAMP,

  -- 今月の使用状況
  downloads_this_month INTEGER DEFAULT 0,
  support_sessions_this_month INTEGER DEFAULT 0,
  usage_reset_at TIMESTAMP DEFAULT DATE_TRUNC('month', NOW() + INTERVAL '1 month'),

  -- Stripe連携
  stripe_subscription_id VARCHAR(100),

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires ON user_subscriptions(expires_at);

-- ===================================================================
-- 3. systems テーブル（インターン作成システムカタログ）
-- ===================================================================
CREATE TABLE IF NOT EXISTS systems (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,                -- システム名
  slug VARCHAR(100) UNIQUE NOT NULL,         -- URL用スラッグ
  description TEXT,                          -- 説明
  category VARCHAR(50),                      -- カテゴリ（'spreadsheet', 'calendar', 'email', etc.）

  -- 開発者情報
  developer_name VARCHAR(100),               -- インターン名
  developed_at TIMESTAMP,                    -- 開発日

  -- コード情報
  code_content TEXT,                         -- GASコード本体
  setup_instructions TEXT,                   -- セットアップ手順

  -- 表示用
  thumbnail_url TEXT,                        -- サムネイル画像URL
  demo_video_url TEXT,                       -- デモ動画URL
  difficulty_level VARCHAR(20) DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced'
  estimated_time_minutes INTEGER,            -- セットアップ推定時間

  -- 統計
  download_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  rating_average NUMERIC(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,

  -- 状態
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,         -- おすすめフラグ

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_systems_slug ON systems(slug);
CREATE INDEX IF NOT EXISTS idx_systems_category ON systems(category);
CREATE INDEX IF NOT EXISTS idx_systems_published ON systems(is_published);
CREATE INDEX IF NOT EXISTS idx_systems_featured ON systems(is_featured);

-- ===================================================================
-- 4. system_documents テーブル（システム設計書・ドキュメント、RAG用）
-- ===================================================================
CREATE TABLE IF NOT EXISTS system_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,

  -- ドキュメント情報
  doc_type VARCHAR(50) NOT NULL,             -- 'requirements', 'design', 'user_manual', 'faq'
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,                     -- ドキュメント本文

  -- メタデータ
  metadata JSONB DEFAULT '{}',

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_documents_system ON system_documents(system_id);
CREATE INDEX IF NOT EXISTS idx_system_documents_type ON system_documents(doc_type);

-- ===================================================================
-- 5. system_embeddings テーブル（ベクトル埋め込み、RAG用）
-- ===================================================================
CREATE TABLE IF NOT EXISTS system_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  document_id UUID REFERENCES system_documents(id) ON DELETE CASCADE,

  -- チャンク情報
  chunk_index INTEGER NOT NULL,              -- チャンク番号
  chunk_text TEXT NOT NULL,                  -- チャンクテキスト

  -- ベクトル埋め込み（1536次元、OpenAI text-embedding-ada-002互換）
  -- Supabaseでpgvectorが有効な場合のみ使用可能
  -- embedding vector(1536),

  -- pgvectorが使えない場合の代替（JSON配列）
  embedding_json JSONB,

  -- メタデータ
  metadata JSONB DEFAULT '{}',

  -- タイムスタンプ
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_embeddings_system ON system_embeddings(system_id);
CREATE INDEX IF NOT EXISTS idx_system_embeddings_document ON system_embeddings(document_id);

-- pgvectorインデックス（pgvectorが有効な場合）
-- CREATE INDEX IF NOT EXISTS idx_system_embeddings_vector ON system_embeddings
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ===================================================================
-- 6. user_downloads テーブル（ダウンロード履歴・ロック機能用）
-- ===================================================================
CREATE TABLE IF NOT EXISTS user_downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,                     -- LINE User ID
  system_id UUID NOT NULL REFERENCES systems(id),
  subscription_id UUID REFERENCES user_subscriptions(id),

  -- ダウンロード情報
  downloaded_at TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,

  -- 状態
  is_revoked BOOLEAN DEFAULT false,          -- アクセス権取り消し済み
  revoked_at TIMESTAMP,
  revoke_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_downloads_user ON user_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_downloads_system ON user_downloads(system_id);
CREATE INDEX IF NOT EXISTS idx_user_downloads_date ON user_downloads(downloaded_at);

-- ===================================================================
-- 7. user_system_access テーブル（閲覧可能システムの管理）
-- ===================================================================
CREATE TABLE IF NOT EXISTS user_system_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,                     -- LINE User ID
  system_id UUID NOT NULL REFERENCES systems(id),

  -- アクセス権情報
  access_type VARCHAR(20) NOT NULL,          -- 'view', 'download'
  granted_at TIMESTAMP DEFAULT NOW(),
  granted_by TEXT,                           -- 付与者（管理者ID）
  expires_at TIMESTAMP,                      -- 有効期限（NULL=永続）

  -- 状態
  is_active BOOLEAN DEFAULT true,

  UNIQUE(user_id, system_id, access_type)
);

CREATE INDEX IF NOT EXISTS idx_user_system_access_user ON user_system_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_system_access_system ON user_system_access(system_id);

-- ===================================================================
-- RPC関数
-- ===================================================================

-- 月次ダウンロードカウントのリセット
CREATE OR REPLACE FUNCTION reset_monthly_download_count()
RETURNS void AS $$
BEGIN
  UPDATE user_subscriptions
  SET downloads_this_month = 0,
      support_sessions_this_month = 0,
      usage_reset_at = DATE_TRUNC('month', NOW() + INTERVAL '1 month')
  WHERE usage_reset_at <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ダウンロード可否チェック
CREATE OR REPLACE FUNCTION can_download_system(
  p_user_id TEXT,
  p_system_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_subscription RECORD;
  v_plan RECORD;
  v_already_downloaded BOOLEAN;
  v_download_count INTEGER;
BEGIN
  -- アクティブなサブスクリプションを取得
  SELECT us.*, sp.monthly_downloads, sp.viewable_systems
  INTO v_subscription
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
    AND us.expires_at > NOW()
  ORDER BY sp.price_monthly DESC
  LIMIT 1;

  -- サブスクリプションがない
  IF v_subscription IS NULL THEN
    RETURN jsonb_build_object(
      'can_download', false,
      'reason', 'no_subscription',
      'message', 'アクティブなサブスクリプションがありません'
    );
  END IF;

  -- 既にダウンロード済みか確認
  SELECT EXISTS(
    SELECT 1 FROM user_downloads
    WHERE user_id = p_user_id
      AND system_id = p_system_id
      AND is_revoked = false
  ) INTO v_already_downloaded;

  IF v_already_downloaded THEN
    RETURN jsonb_build_object(
      'can_download', true,
      'reason', 'already_downloaded',
      'message', '既にダウンロード済みです（再ダウンロード可能）'
    );
  END IF;

  -- 今月のダウンロード数チェック
  IF v_subscription.downloads_this_month >= v_subscription.monthly_downloads THEN
    RETURN jsonb_build_object(
      'can_download', false,
      'reason', 'download_limit_reached',
      'message', '今月のダウンロード上限に達しました',
      'current', v_subscription.downloads_this_month,
      'limit', v_subscription.monthly_downloads
    );
  END IF;

  RETURN jsonb_build_object(
    'can_download', true,
    'reason', 'ok',
    'message', 'ダウンロード可能です',
    'remaining', v_subscription.monthly_downloads - v_subscription.downloads_this_month
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- システムダウンロード実行
CREATE OR REPLACE FUNCTION execute_system_download(
  p_user_id TEXT,
  p_system_id UUID,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_can_download JSONB;
  v_subscription_id UUID;
  v_download_id UUID;
BEGIN
  -- ダウンロード可否チェック
  v_can_download := can_download_system(p_user_id, p_system_id);

  IF NOT (v_can_download->>'can_download')::boolean THEN
    RETURN v_can_download;
  END IF;

  -- 既にダウンロード済みの場合はカウント増やさない
  IF v_can_download->>'reason' = 'already_downloaded' THEN
    RETURN v_can_download;
  END IF;

  -- サブスクリプションID取得
  SELECT id INTO v_subscription_id
  FROM user_subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  -- ダウンロード履歴追加
  INSERT INTO user_downloads (user_id, system_id, subscription_id, ip_address, user_agent)
  VALUES (p_user_id, p_system_id, v_subscription_id, p_ip_address, p_user_agent)
  RETURNING id INTO v_download_id;

  -- ダウンロードカウント増加
  UPDATE user_subscriptions
  SET downloads_this_month = downloads_this_month + 1,
      updated_at = NOW()
  WHERE id = v_subscription_id;

  -- システムのダウンロードカウント増加
  UPDATE systems
  SET download_count = download_count + 1,
      updated_at = NOW()
  WHERE id = p_system_id;

  RETURN jsonb_build_object(
    'success', true,
    'download_id', v_download_id,
    'message', 'ダウンロードが完了しました'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================================================================
-- Row Level Security
-- ===================================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_system_access ENABLE ROW LEVEL SECURITY;

-- subscription_plans: 誰でも閲覧可能
CREATE POLICY "Anyone can view active plans" ON subscription_plans
  FOR SELECT USING (is_active = true);

-- systems: 公開システムは誰でも閲覧可能
CREATE POLICY "Anyone can view published systems" ON systems
  FOR SELECT USING (is_published = true);

-- user_subscriptions: 自分のサブスク情報のみ閲覧可能
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
  FOR SELECT USING (user_id = auth.uid()::text OR auth.jwt() ->> 'role' = 'admin');

-- user_downloads: 自分のダウンロード履歴のみ閲覧可能
CREATE POLICY "Users can view own downloads" ON user_downloads
  FOR SELECT USING (user_id = auth.uid()::text OR auth.jwt() ->> 'role' = 'admin');

-- ===================================================================
-- トリガー
-- ===================================================================

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_systems_updated_at
  BEFORE UPDATE ON systems
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_documents_updated_at
  BEFORE UPDATE ON system_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- 完了
-- ===================================================================
