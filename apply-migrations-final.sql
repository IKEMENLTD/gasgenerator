-- =====================================================
-- 本番用マイグレーション最終版 v4
-- 既存テーブル構造に完全対応 
-- 実行前に必ずバックアップを取得してください
-- =====================================================

-- =====================================================
-- STEP 0: 事前チェック（どのテーブルが存在するか確認）
-- =====================================================
DO $$
DECLARE
  v_users_exists boolean;
  v_conversation_sessions_exists boolean;
  v_support_requests_exists boolean;
BEGIN
  -- テーブル存在確認
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'users') INTO v_users_exists;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_sessions') INTO v_conversation_sessions_exists;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'support_requests') INTO v_support_requests_exists;

  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 現在のデータベース状態';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'users テーブル: %', CASE WHEN v_users_exists THEN '✅ 存在' ELSE '❌ 存在しない' END;
  RAISE NOTICE 'conversation_sessions テーブル: %', CASE WHEN v_conversation_sessions_exists THEN '✅ 存在' ELSE '❌ 存在しない' END;
  RAISE NOTICE 'support_requests テーブル: %', CASE WHEN v_support_requests_exists THEN '✅ 存在' ELSE '❌ 存在しない' END;

  -- usersテーブルが存在しない場合はエラー
  IF NOT v_users_exists THEN
    RAISE EXCEPTION 'users テーブルが存在しません。マイグレーションを中止します。';
  END IF;
END $$;

-- =====================================================
-- STEP 1: usersテーブルのカラム追加（既存チェック付き）
-- =====================================================

-- 1-1. line_user_id カラム追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'line_user_id'
  ) THEN
    ALTER TABLE users ADD COLUMN line_user_id TEXT;
    RAISE NOTICE '✅ users.line_user_id カラムを追加しました';

    -- display_nameからデータ移行
    UPDATE users u
    SET line_user_id = u.display_name
    WHERE u.line_user_id IS NULL
    AND u.display_name IS NOT NULL;

    RAISE NOTICE '✅ display_name から line_user_id へデータを移行しました';
  ELSE
    RAISE NOTICE '⏭️ users.line_user_id は既に存在します';
  END IF;
END $$;

-- 1-2. payment_start_date カラム追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'payment_start_date'
  ) THEN
    ALTER TABLE users ADD COLUMN payment_start_date TIMESTAMP;

    -- 既存のプレミアムユーザーに初期値設定
    UPDATE users
    SET payment_start_date = COALESCE(subscription_started_at, created_at, CURRENT_TIMESTAMP)
    WHERE subscription_status = 'premium'
    AND payment_start_date IS NULL;

    RAISE NOTICE '✅ users.payment_start_date カラムを追加しました';
  ELSE
    RAISE NOTICE '⏭️ users.payment_start_date は既に存在します';
  END IF;
END $$;

-- 1-3. last_reset_month カラム追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_reset_month'
  ) THEN
    ALTER TABLE users ADD COLUMN last_reset_month INTEGER DEFAULT 0;
    RAISE NOTICE '✅ users.last_reset_month カラムを追加しました';
  ELSE
    RAISE NOTICE '⏭️ users.last_reset_month は既に存在します';
  END IF;
END $$;

-- 1-4. ai_preference カラム追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'ai_preference'
  ) THEN
    ALTER TABLE users ADD COLUMN ai_preference TEXT DEFAULT 'detailed';
    RAISE NOTICE '✅ users.ai_preference カラムを追加しました';
  ELSE
    RAISE NOTICE '⏭️ users.ai_preference は既に存在します';
  END IF;
END $$;

-- =====================================================
-- STEP 2: インデックスの追加（パフォーマンス向上）
-- =====================================================

-- users テーブル用インデックス
CREATE INDEX IF NOT EXISTS idx_users_line_user_id
ON users(line_user_id)
WHERE line_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_payment_start_date
ON users(payment_start_date)
WHERE payment_start_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_subscription_status
ON users(subscription_status);

CREATE INDEX IF NOT EXISTS idx_users_is_premium
ON users(is_premium);

-- conversation_sessions テーブル用インデックス
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_status
ON conversation_sessions(user_id, status, created_at DESC);

-- generated_codes テーブル用インデックス
CREATE INDEX IF NOT EXISTS idx_generated_codes_user_created
ON generated_codes(user_id, created_at DESC);

-- claude_usage テーブル用インデックス
CREATE INDEX IF NOT EXISTS idx_claude_usage_user_created
ON claude_usage(user_id, created_at DESC);

DO $$
BEGIN
  RAISE NOTICE '✅ インデックスを追加/更新しました';
END $$;

-- =====================================================
-- STEP 3: 新規テーブルの作成（存在しない場合のみ）
-- =====================================================

-- 3-1. requirement_extractions テーブル（AI要件抽出履歴）
CREATE TABLE IF NOT EXISTS requirement_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  conversation_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  extracted_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_level INTEGER DEFAULT 0 CHECK (confidence_level >= 0 AND confidence_level <= 100),
  extraction_method TEXT DEFAULT 'ai' CHECK (extraction_method IN ('ai', 'manual', 'hybrid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_requirement_extractions_session_id
ON requirement_extractions(session_id);

CREATE INDEX IF NOT EXISTS idx_requirement_extractions_user_id
ON requirement_extractions(user_id);

CREATE INDEX IF NOT EXISTS idx_requirement_extractions_created_at
ON requirement_extractions(created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'requirement_extractions') THEN
    RAISE NOTICE '✅ requirement_extractions テーブルを作成しました';
  ELSE
    RAISE NOTICE '⏭️ requirement_extractions テーブル作成をスキップしました';
  END IF;
END $$;

-- 3-2. code_quality_checks テーブル（コード品質チェック）
CREATE TABLE IF NOT EXISTS code_quality_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_share_id UUID,
  session_id TEXT,
  check_type TEXT NOT NULL CHECK (check_type IN ('security', 'performance', 'requirements', 'comprehensive')),
  issues JSONB DEFAULT '[]'::jsonb,
  warnings JSONB DEFAULT '[]'::jsonb,
  suggestions JSONB DEFAULT '[]'::jsonb,
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  checked_by TEXT DEFAULT 'claude-sonnet-4',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_code_quality_checks_session_id
ON code_quality_checks(session_id);

CREATE INDEX IF NOT EXISTS idx_code_quality_checks_code_share_id
ON code_quality_checks(code_share_id);

CREATE INDEX IF NOT EXISTS idx_code_quality_checks_created_at
ON code_quality_checks(created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'code_quality_checks') THEN
    RAISE NOTICE '✅ code_quality_checks テーブルを作成しました';
  ELSE
    RAISE NOTICE '⏭️ code_quality_checks テーブル作成をスキップしました';
  END IF;
END $$;

-- =====================================================
-- STEP 4: ビューの作成/更新（既存カラムのみ使用）
-- =====================================================

-- 4-1. ユーザー統計ビュー
DROP VIEW IF EXISTS user_generation_stats CASCADE;
CREATE VIEW user_generation_stats AS
SELECT
  COALESCE(u.line_user_id, u.display_name) as user_identifier,
  u.display_name,
  u.line_user_id,
  u.subscription_status,
  u.is_premium,
  u.monthly_usage_count,
  u.subscription_end_date,
  u.payment_start_date,
  -- generated_codes の統計
  COUNT(DISTINCT gc.id) as total_codes_generated,
  COUNT(DISTINCT gc.session_id) as unique_sessions_with_code,
  -- code_shares の統計
  COUNT(DISTINCT cs.id) as total_shares_created,
  SUM(cs.view_count) as total_share_views,
  -- claude_usage の統計
  COUNT(DISTINCT cu.session_id) as ai_sessions,
  ROUND(AVG(cu.total_tokens)::numeric, 2) as avg_tokens_per_request,
  COALESCE(SUM(cu.total_tokens), 0) as total_tokens_used,
  ROUND(COALESCE(SUM(cu.total_cost::numeric), 0), 4) as total_cost_usd,
  -- conversation_sessions の統計
  COUNT(DISTINCT conv.id) as total_conversations,
  -- 日付統計
  MAX(gc.created_at) as last_code_generated,
  MAX(u.last_active_at) as last_active,
  u.created_at as user_since
FROM users u
-- generated_codes との結合
LEFT JOIN generated_codes gc ON (
  gc.user_id = u.line_user_id OR
  gc.user_id = u.display_name
)
-- code_shares との結合
LEFT JOIN code_shares cs ON (
  cs.user_id = u.line_user_id OR
  cs.user_id = u.display_name
)
-- claude_usage との結合
LEFT JOIN claude_usage cu ON (
  cu.user_id = u.line_user_id OR
  cu.user_id = u.display_name
)
-- conversation_sessions との結合
LEFT JOIN conversation_sessions conv ON (
  conv.user_id = u.line_user_id OR
  conv.user_id = u.display_name
)
GROUP BY
  u.line_user_id,
  u.display_name,
  u.subscription_status,
  u.is_premium,
  u.monthly_usage_count,
  u.subscription_end_date,
  u.payment_start_date,
  u.created_at,
  u.last_active_at;

-- 4-2. アクティブセッションビュー
DROP VIEW IF EXISTS active_sessions CASCADE;
CREATE VIEW active_sessions AS
SELECT
  cs.id as session_id,
  cs.user_id,
  cs.status,
  cs.category,
  cs.subcategory,
  cs.created_at,
  cs.updated_at,
  -- 要件情報（存在するカラムのみ）
  cs.collected_requirements as requirements,
  cs.ready_for_code,
  -- メッセージ統計
  CASE
    WHEN cs.messages IS NOT NULL AND jsonb_typeof(cs.messages) = 'array'
    THEN jsonb_array_length(cs.messages)
    ELSE 0
  END as message_count,
  -- コード生成統計
  COUNT(DISTINCT gc.id) as codes_generated,
  MAX(gc.created_at) as last_code_generated,
  -- ユーザー情報
  u.subscription_status,
  u.is_premium
FROM conversation_sessions cs
LEFT JOIN generated_codes gc ON cs.id::text = gc.session_id
LEFT JOIN users u ON (
  cs.user_id = u.line_user_id OR
  cs.user_id = u.display_name
)
WHERE cs.status IN ('active', 'waiting', 'processing')
  AND cs.updated_at > NOW() - INTERVAL '24 hours'
GROUP BY
  cs.id,
  cs.user_id,
  cs.status,
  cs.category,
  cs.subcategory,
  cs.created_at,
  cs.updated_at,
  cs.collected_requirements,
  cs.ready_for_code,
  cs.messages,
  u.subscription_status,
  u.is_premium;

DO $$
BEGIN
  RAISE NOTICE '✅ ビューを作成/更新しました';
END $$;

-- =====================================================
-- STEP 5: データ整合性チェックと修正
-- =====================================================

DO $$
DECLARE
  v_orphan_sessions integer;
BEGIN
  -- 孤立したセッション数をカウント
  SELECT COUNT(*)
  INTO v_orphan_sessions
  FROM conversation_sessions cs
  WHERE cs.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.line_user_id = cs.user_id
    OR u.display_name = cs.user_id
  );

  IF v_orphan_sessions > 0 THEN
    RAISE NOTICE '⚠️ 孤立したセッションが % 件見つかりました', v_orphan_sessions;
    RAISE NOTICE '必要に応じて手動でユーザーを作成してください';
  ELSE
    RAISE NOTICE '✅ データ整合性チェック完了：問題なし';
  END IF;
END $$;

-- =====================================================
-- STEP 6: コメントの追加（ドキュメント化）
-- =====================================================

-- テーブルコメント
COMMENT ON TABLE requirement_extractions IS 'AI要件抽出の履歴と精度追跡';
COMMENT ON TABLE code_quality_checks IS 'AIによるコード品質チェック結果';

-- カラムコメント
COMMENT ON COLUMN users.line_user_id IS 'LINEユーザーID（主要識別子）';
COMMENT ON COLUMN users.payment_start_date IS 'プレミアムプラン決済開始日（月次更新の基準）';
COMMENT ON COLUMN users.last_reset_month IS '決済日から何ヶ月目か（月次リセット管理用）';
COMMENT ON COLUMN users.ai_preference IS 'AI応答スタイル（detailed/concise/technical）';

-- =====================================================
-- STEP 7: 最終検証
-- =====================================================

DO $$
DECLARE
  v_users_line_user_id boolean;
  v_users_payment_start boolean;
  v_req_extractions boolean;
  v_quality_checks boolean;
  v_stats_view boolean;
  v_active_view boolean;
BEGIN
  -- カラム存在チェック
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'line_user_id') INTO v_users_line_user_id;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'payment_start_date') INTO v_users_payment_start;

  -- テーブル存在チェック
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'requirement_extractions') INTO v_req_extractions;
  SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'code_quality_checks') INTO v_quality_checks;

  -- ビュー存在チェック
  SELECT EXISTS(SELECT 1 FROM information_schema.views WHERE table_name = 'user_generation_stats') INTO v_stats_view;
  SELECT EXISTS(SELECT 1 FROM information_schema.views WHERE table_name = 'active_sessions') INTO v_active_view;

  RAISE NOTICE '';
  RAISE NOTICE '=========================================';
  RAISE NOTICE '📊 マイグレーション完了状況';
  RAISE NOTICE '=========================================';
  RAISE NOTICE '';
  RAISE NOTICE '【usersテーブル拡張】';
  RAISE NOTICE '  line_user_id: %', CASE WHEN v_users_line_user_id THEN '✅ 完了' ELSE '❌ 失敗' END;
  RAISE NOTICE '  payment_start_date: %', CASE WHEN v_users_payment_start THEN '✅ 完了' ELSE '❌ 失敗' END;
  RAISE NOTICE '';
  RAISE NOTICE '【新規テーブル】';
  RAISE NOTICE '  requirement_extractions: %', CASE WHEN v_req_extractions THEN '✅ 作成済み' ELSE '❌ 未作成' END;
  RAISE NOTICE '  code_quality_checks: %', CASE WHEN v_quality_checks THEN '✅ 作成済み' ELSE '❌ 未作成' END;
  RAISE NOTICE '';
  RAISE NOTICE '【ビュー】';
  RAISE NOTICE '  user_generation_stats: %', CASE WHEN v_stats_view THEN '✅ 作成済み' ELSE '❌ 未作成' END;
  RAISE NOTICE '  active_sessions: %', CASE WHEN v_active_view THEN '✅ 作成済み' ELSE '❌ 未作成' END;
  RAISE NOTICE '';
  RAISE NOTICE '=========================================';

  -- 全て成功していない場合は警告
  IF NOT (v_users_line_user_id AND v_users_payment_start AND v_req_extractions AND v_quality_checks) THEN
    RAISE WARNING '⚠️ 一部のマイグレーションが失敗しています。ログを確認してください。';
  ELSE
    RAISE NOTICE '🎉 全てのマイグレーションが正常に完了しました！';
  END IF;
END $$;

-- =====================================================
-- 実行後の確認用クエリ
-- =====================================================

-- 追加されたカラムの確認
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('line_user_id', 'payment_start_date', 'last_reset_month', 'ai_preference')
ORDER BY column_name;

-- 新規テーブルの確認
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('requirement_extractions', 'code_quality_checks')
ORDER BY table_name;

-- ビューの確認
SELECT table_name
FROM information_schema.views
WHERE table_name IN ('user_generation_stats', 'active_sessions')
ORDER BY table_name;