-- プロフェッショナルプラン対応のためのスキーマ更新
-- 2025-01-17

-- 既存のビューを一時的に削除（依存関係のため）
DROP VIEW IF EXISTS user_generation_stats CASCADE;
DROP VIEW IF EXISTS subscription_statistics CASCADE;

-- 既存の制約を削除
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_subscription_status_check;

-- usersテーブルのsubscription_statusにprofessionalを追加
ALTER TABLE users
ALTER COLUMN subscription_status TYPE text;

-- 新しい制約を追加してprofessionalを許可
ALTER TABLE users
ADD CONSTRAINT users_subscription_status_check
CHECK (subscription_status IN ('free', 'premium', 'professional'));

-- プロフェッショナルプラン用のフィールド追加
ALTER TABLE users
ADD COLUMN IF NOT EXISTS payment_start_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_reset_month integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS priority_support boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS assigned_engineer_id text,
ADD COLUMN IF NOT EXISTS professional_features jsonb DEFAULT '{}';

-- インデックスの追加
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_priority_support ON users(priority_support);

-- プロフェッショナルプラン用のサポートチケットテーブル
CREATE TABLE IF NOT EXISTS support_tickets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(display_name),
    ticket_number text UNIQUE NOT NULL,
    priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    subject text NOT NULL,
    description text NOT NULL,
    assigned_engineer_id text,
    response_time_hours integer,
    resolution_time_hours integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone
);

-- サポートチケットのインデックス
CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);

-- プロフェッショナルプラン機能使用ログ
CREATE TABLE IF NOT EXISTS professional_features_usage (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(display_name),
    feature_name text NOT NULL,
    usage_count integer DEFAULT 1,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);

-- 使用ログのインデックス
CREATE INDEX idx_professional_features_usage_user_id ON professional_features_usage(user_id);
CREATE INDEX idx_professional_features_usage_feature ON professional_features_usage(feature_name);

-- プロフェッショナルプラン用のプライオリティキュー更新
ALTER TABLE processing_queue
ADD COLUMN IF NOT EXISTS is_professional boolean DEFAULT false;

-- プライオリティの自動設定トリガー
CREATE OR REPLACE FUNCTION set_professional_priority()
RETURNS TRIGGER AS $$
BEGIN
    -- プロフェッショナルプランユーザーのジョブに高優先度を設定
    IF EXISTS (
        SELECT 1 FROM users
        WHERE display_name = NEW.user_id
        AND subscription_status = 'professional'
    ) THEN
        NEW.priority := 10;  -- 最高優先度
        NEW.is_professional := true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成
DROP TRIGGER IF EXISTS set_professional_priority_trigger ON processing_queue;
CREATE TRIGGER set_professional_priority_trigger
BEFORE INSERT ON processing_queue
FOR EACH ROW
EXECUTE FUNCTION set_professional_priority();

-- サブスクリプション更新時のトリガー
CREATE OR REPLACE FUNCTION handle_subscription_update()
RETURNS TRIGGER AS $$
BEGIN
    -- プロフェッショナルプランへのアップグレード時
    IF NEW.subscription_status = 'professional' AND
       (OLD.subscription_status IS NULL OR OLD.subscription_status != 'professional') THEN
        NEW.priority_support := true;
        NEW.professional_features := jsonb_build_object(
            'api_access', true,
            'custom_solutions', true,
            'dedicated_engineer', true,
            'complex_requirements', true,
            'priority_processing', true
        );
    END IF;

    -- プロフェッショナルプランからのダウングレード時
    IF OLD.subscription_status = 'professional' AND
       NEW.subscription_status != 'professional' THEN
        NEW.priority_support := false;
        NEW.assigned_engineer_id := NULL;
        NEW.professional_features := '{}';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガーの作成
DROP TRIGGER IF EXISTS subscription_update_trigger ON users;
CREATE TRIGGER subscription_update_trigger
BEFORE UPDATE OF subscription_status ON users
FOR EACH ROW
EXECUTE FUNCTION handle_subscription_update();

-- 統計ビューの作成
CREATE OR REPLACE VIEW subscription_statistics AS
SELECT
    subscription_status,
    COUNT(*) as user_count,
    COUNT(*) FILTER (WHERE last_active_at > now() - interval '7 days') as active_last_7days,
    COUNT(*) FILTER (WHERE last_active_at > now() - interval '30 days') as active_last_30days
FROM users
GROUP BY subscription_status;

-- プロフェッショナルプラン用のAPI機能
CREATE TABLE IF NOT EXISTS api_keys (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(display_name),
    key_hash text NOT NULL UNIQUE,
    name text NOT NULL,
    permissions jsonb NOT NULL DEFAULT '[]',
    rate_limit integer DEFAULT 100,
    is_active boolean DEFAULT true,
    last_used_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- APIキーのインデックス
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);

-- Row Level Security (RLS) の設定
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_features_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- ポリシーの作成
CREATE POLICY support_tickets_user_policy ON support_tickets
    FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY professional_features_usage_policy ON professional_features_usage
    FOR ALL USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY api_keys_user_policy ON api_keys
    FOR ALL USING (user_id = current_setting('app.current_user_id', true));

COMMENT ON COLUMN users.payment_start_date IS '決済開始日（月次リセットの基準日）';
COMMENT ON COLUMN users.last_reset_month IS '最後にリセットした月数（決済日からの経過月数）';
COMMENT ON COLUMN users.priority_support IS 'プロフェッショナルプランの優先サポートフラグ';
COMMENT ON COLUMN users.assigned_engineer_id IS '専任エンジニアのID';
COMMENT ON COLUMN users.professional_features IS 'プロフェッショナルプランの機能フラグ';

-- ビューを再作成
CREATE OR REPLACE VIEW user_generation_stats AS
SELECT
    u.display_name,
    u.subscription_status,
    u.monthly_usage_count,
    u.total_requests,
    COUNT(DISTINCT gc.id) as codes_generated,
    COUNT(DISTINCT cs.id) as share_links_created
FROM users u
LEFT JOIN generated_codes gc ON gc.user_id = u.display_name
LEFT JOIN code_shares cs ON cs.user_id = u.display_name
GROUP BY u.display_name, u.subscription_status, u.monthly_usage_count, u.total_requests;

-- 統計ビューも再作成
CREATE OR REPLACE VIEW subscription_statistics AS
SELECT
    subscription_status,
    COUNT(*) as user_count,
    COUNT(*) FILTER (WHERE last_active_at > now() - interval '7 days') as active_last_7days,
    COUNT(*) FILTER (WHERE last_active_at > now() - interval '30 days') as active_last_30days,
    COUNT(*) FILTER (WHERE subscription_status = 'professional') as professional_users
FROM users
GROUP BY subscription_status;