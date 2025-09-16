-- 統合マイグレーションファイル v2
-- 実行方法: Supabase SQL Editorで実行してください
-- 注意: IF NOT EXISTSで既存カラムはスキップされます

-- =====================================
-- 0. 事前チェック（既存カラム確認）
-- =====================================
DO $$
BEGIN
  -- usersテーブルが存在するか確認
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    RAISE EXCEPTION 'users table does not exist';
  END IF;
END $$;

-- =====================================
-- 1. usersテーブルに必要なカラムを追加
-- =====================================
-- line_user_id: LINEユーザーID（primary key的な役割）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'line_user_id') THEN
    ALTER TABLE users ADD COLUMN line_user_id TEXT;
    -- ユニーク制約は別途追加（既存データがある場合のため）
  END IF;
END $$;

-- payment_start_date: プレミアム決済開始日
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'payment_start_date') THEN
    ALTER TABLE users ADD COLUMN payment_start_date TIMESTAMP DEFAULT NULL;
  END IF;
END $$;

-- last_reset_month: 決済日から何ヶ月目か
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'last_reset_month') THEN
    ALTER TABLE users ADD COLUMN last_reset_month INTEGER DEFAULT 0;
  END IF;
END $$;

-- ai_preference: AI応答スタイル
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'ai_preference') THEN
    ALTER TABLE users ADD COLUMN ai_preference TEXT DEFAULT 'detailed';
  END IF;
END $$;

-- display_nameからline_user_idへデータ移行（既存データの整合性確保）
UPDATE users
SET line_user_id = display_name
WHERE line_user_id IS NULL AND display_name IS NOT NULL;

-- line_user_idにユニーク制約を追加（重複がない場合のみ）
DO $$
BEGIN
  -- 重複チェック
  IF NOT EXISTS (
    SELECT line_user_id, COUNT(*)
    FROM users
    WHERE line_user_id IS NOT NULL
    GROUP BY line_user_id
    HAVING COUNT(*) > 1
  ) THEN
    -- ユニーク制約がなければ追加
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'users_line_user_id_key'
    ) THEN
      ALTER TABLE users ADD CONSTRAINT users_line_user_id_key UNIQUE (line_user_id);
    END IF;
  ELSE
    RAISE NOTICE 'Duplicate line_user_id found, skipping unique constraint';
  END IF;
END $$;

-- インデックス追加（パフォーマンス最適化）
CREATE INDEX IF NOT EXISTS idx_users_payment_start_date ON users(payment_start_date) WHERE payment_start_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id) WHERE line_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name) WHERE display_name IS NOT NULL;

-- 既存のプレミアムユーザーのpayment_start_dateを設定（subscription_started_atから取得）
UPDATE users
SET payment_start_date = COALESCE(subscription_started_at, CURRENT_TIMESTAMP)
WHERE subscription_status = 'premium'
AND payment_start_date IS NULL;

-- コメント追加
COMMENT ON COLUMN users.payment_start_date IS 'プレミアムプラン決済開始日（月次更新の基準日）';
COMMENT ON COLUMN users.last_reset_month IS '最後にリセットした月数（決済日から何ヶ月目か）';
COMMENT ON COLUMN users.line_user_id IS 'LINEユーザーID（主要識別子）';
COMMENT ON COLUMN users.ai_preference IS 'AI応答スタイル設定（detailed/concise/technical）';

-- =====================================
-- 2. 要件抽出の履歴テーブル
-- =====================================
CREATE TABLE IF NOT EXISTS requirement_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  conversation_messages JSONB NOT NULL,
  extracted_requirements JSONB NOT NULL,
  confidence_level INTEGER DEFAULT 0,
  extraction_method TEXT DEFAULT 'ai',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requirement_extractions_user_id
ON requirement_extractions(user_id);

CREATE INDEX IF NOT EXISTS idx_requirement_extractions_session_id
ON requirement_extractions(session_id);

COMMENT ON TABLE requirement_extractions IS 'AI要件抽出の履歴と精度追跡';

-- =====================================
-- 3. コード品質チェック結果
-- =====================================
CREATE TABLE IF NOT EXISTS code_quality_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID,
  session_id TEXT,
  check_type TEXT NOT NULL,
  issues JSONB DEFAULT '[]',
  score INTEGER DEFAULT 0,
  checked_by TEXT DEFAULT 'claude-sonnet-4',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_quality_checks_session_id
ON code_quality_checks(session_id);

COMMENT ON TABLE code_quality_checks IS 'AIによるコード品質チェック結果';

-- =====================================
-- 4. パフォーマンス改善のインデックス
-- =====================================
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_status
ON conversation_sessions(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_codes_user_created
ON generated_codes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_claude_usage_user_created
ON claude_usage(user_id, created_at DESC);

-- =====================================
-- 5. ユーザー統計ビュー（既存カラムのみ使用）
-- =====================================
DROP VIEW IF EXISTS user_generation_stats;
CREATE VIEW user_generation_stats AS
SELECT
  COALESCE(u.line_user_id, u.display_name) as user_identifier,
  u.display_name,
  u.subscription_status,
  u.monthly_usage_count,
  u.is_premium,
  u.subscription_end_date,
  COUNT(DISTINCT gc.id) as total_codes_generated,
  COUNT(DISTINCT cs.id) as total_shares_created,
  ROUND(AVG(cu.total_tokens)::numeric, 2) as avg_tokens_per_request,
  COALESCE(SUM(cu.total_tokens), 0) as total_tokens_used,
  MAX(gc.created_at) as last_generation_date,
  u.created_at as user_since,
  u.last_active_at
FROM users u
LEFT JOIN generated_codes gc ON COALESCE(u.line_user_id, u.display_name) = gc.user_id
LEFT JOIN code_shares cs ON COALESCE(u.line_user_id, u.display_name) = cs.user_id
LEFT JOIN claude_usage cu ON COALESCE(u.line_user_id, u.display_name) = cu.user_id
GROUP BY u.line_user_id, u.display_name, u.subscription_status, u.monthly_usage_count,
         u.is_premium, u.subscription_end_date, u.created_at, u.last_active_at;

-- =====================================
-- 6. アクティブセッションビュー（既存カラムチェック済み）
-- =====================================
DROP VIEW IF EXISTS active_sessions;
CREATE VIEW active_sessions AS
SELECT
  cs.session_id,
  cs.user_id,
  cs.status,
  cs.created_at,
  cs.updated_at,
  cs.category,
  cs.subcategory,
  JSONB_ARRAY_LENGTH(cs.messages) as message_count,
  cs.ready_for_code,
  COUNT(gc.id) as codes_in_session,
  MAX(gc.created_at) as last_code_generated
FROM conversation_sessions cs
LEFT JOIN generated_codes gc ON cs.session_id = gc.session_id
WHERE cs.status IN ('active', 'waiting', 'processing')
  AND cs.updated_at > NOW() - INTERVAL '24 hours'
GROUP BY cs.session_id, cs.user_id, cs.status, cs.created_at, cs.updated_at,
         cs.category, cs.subcategory, cs.messages, cs.ready_for_code;

-- =====================================
-- 7. 検証クエリ
-- =====================================
-- 追加されたカラムの確認
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('line_user_id', 'payment_start_date', 'last_reset_month', 'ai_preference');

-- 新しいテーブルの確認
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('requirement_extractions', 'code_quality_checks');

-- インデックスの確認
SELECT indexname
FROM pg_indexes
WHERE tablename = 'users'
AND indexname LIKE 'idx_users_%';

-- =====================================
-- 8. 成功メッセージ
-- =====================================
DO $$
DECLARE
  v_line_user_id_exists boolean;
  v_payment_start_date_exists boolean;
  v_requirement_extractions_exists boolean;
BEGIN
  -- カラム存在チェック
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'line_user_id'
  ) INTO v_line_user_id_exists;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'payment_start_date'
  ) INTO v_payment_start_date_exists;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'requirement_extractions'
  ) INTO v_requirement_extractions_exists;

  RAISE NOTICE '=========================================';
  RAISE NOTICE '✅ マイグレーション完了状況';
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'line_user_id カラム: %', CASE WHEN v_line_user_id_exists THEN '✅ 追加済み' ELSE '❌ 未追加' END;
  RAISE NOTICE 'payment_start_date カラム: %', CASE WHEN v_payment_start_date_exists THEN '✅ 追加済み' ELSE '❌ 未追加' END;
  RAISE NOTICE 'requirement_extractions テーブル: %', CASE WHEN v_requirement_extractions_exists THEN '✅ 作成済み' ELSE '❌ 未作成' END;
  RAISE NOTICE '=========================================';
END $$;