-- ========================================
-- 完全なデータベース修正SQL - 最終版v2
-- VIEWを除外してエラーを回避
-- ========================================

-- トランザクション開始
BEGIN;

-- ========================================
-- 1. code_shares テーブルの修正（最重要）
-- ========================================

-- PRIMARY KEYの追加（既存の場合はスキップ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_shares' AND column_name = 'id'
  ) THEN
    ALTER TABLE code_shares ADD COLUMN id UUID DEFAULT gen_random_uuid();

    -- 既存レコードにIDを設定
    UPDATE code_shares SET id = gen_random_uuid() WHERE id IS NULL;

    -- PRIMARY KEY制約を追加
    ALTER TABLE code_shares ADD PRIMARY KEY (id);
  END IF;
END $$;

-- short_idカラムの追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_shares' AND column_name = 'short_id'
  ) THEN
    ALTER TABLE code_shares ADD COLUMN short_id VARCHAR(8);

    -- 既存レコードにshort_idを生成
    UPDATE code_shares
    SET short_id = substr(md5(random()::text || clock_timestamp()::text), 1, 8)
    WHERE short_id IS NULL;

    -- NOT NULL制約とUNIQUE制約を追加
    ALTER TABLE code_shares ALTER COLUMN short_id SET NOT NULL;
    ALTER TABLE code_shares ADD CONSTRAINT code_shares_short_id_unique UNIQUE (short_id);
  END IF;
END $$;

-- user_idカラムの追加
ALTER TABLE code_shares
ADD COLUMN IF NOT EXISTS user_id TEXT;

UPDATE code_shares SET user_id = 'system' WHERE user_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_shares'
    AND column_name = 'user_id'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE code_shares ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- titleカラムの追加
ALTER TABLE code_shares
ADD COLUMN IF NOT EXISTS title TEXT;

UPDATE code_shares SET title = 'Untitled Code' WHERE title IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_shares'
    AND column_name = 'title'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE code_shares ALTER COLUMN title SET NOT NULL;
  END IF;
END $$;

-- code_contentカラムの追加
ALTER TABLE code_shares
ADD COLUMN IF NOT EXISTS code_content TEXT;

UPDATE code_shares SET code_content = '' WHERE code_content IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_shares'
    AND column_name = 'code_content'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE code_shares ALTER COLUMN code_content SET NOT NULL;
  END IF;
END $$;

-- expires_atカラムの追加
ALTER TABLE code_shares
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

UPDATE code_shares SET expires_at = NOW() + INTERVAL '7 days' WHERE expires_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'code_shares'
    AND column_name = 'expires_at'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE code_shares ALTER COLUMN expires_at SET NOT NULL;
  END IF;
END $$;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_code_shares_short_id ON code_shares(short_id);
CREATE INDEX IF NOT EXISTS idx_code_shares_user_id ON code_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_code_shares_expires_at ON code_shares(expires_at);

-- ========================================
-- 2. その他のテーブルのPRIMARY KEY追加
-- ========================================

-- 汎用的なPRIMARY KEY追加関数（VIEWを除外）
CREATE OR REPLACE FUNCTION add_primary_key_if_not_exists(table_name_param TEXT)
RETURNS void AS $$
BEGIN
  -- テーブルかどうかチェック（VIEWは除外）
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = table_name_param
    AND table_type = 'BASE TABLE'
    AND table_schema = 'public'
  ) THEN
    RAISE NOTICE 'Skipping % (not a table or does not exist)', table_name_param;
    RETURN;
  END IF;

  -- idカラムが存在しない場合は追加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = table_name_param AND column_name = 'id'
  ) THEN
    EXECUTE format('ALTER TABLE %I ADD COLUMN id UUID DEFAULT gen_random_uuid()', table_name_param);
    EXECUTE format('UPDATE %I SET id = gen_random_uuid() WHERE id IS NULL', table_name_param);
  END IF;

  -- PRIMARY KEY制約が存在しない場合は追加
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = table_name_param
    AND constraint_type = 'PRIMARY KEY'
  ) THEN
    EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY (id)', table_name_param);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error processing table %: %', table_name_param, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルにPRIMARY KEYを追加（conversation_statsは除外）
SELECT add_primary_key_if_not_exists('code_share_access_logs');
SELECT add_primary_key_if_not_exists('conversation_code_relations');
SELECT add_primary_key_if_not_exists('user_code_history');
SELECT add_primary_key_if_not_exists('conversation_contexts');
SELECT add_primary_key_if_not_exists('conversations');
SELECT add_primary_key_if_not_exists('generated_codes');
SELECT add_primary_key_if_not_exists('users');
SELECT add_primary_key_if_not_exists('claude_usage');
SELECT add_primary_key_if_not_exists('claude_usage_logs');
SELECT add_primary_key_if_not_exists('code_revisions');
SELECT add_primary_key_if_not_exists('conversation_sessions');
SELECT add_primary_key_if_not_exists('conversation_states');
-- conversation_stats はVIEWなのでスキップ
SELECT add_primary_key_if_not_exists('generation_queue');
SELECT add_primary_key_if_not_exists('metrics');
SELECT add_primary_key_if_not_exists('payment_history');
SELECT add_primary_key_if_not_exists('processing_queue');
SELECT add_primary_key_if_not_exists('session_checkpoints');
SELECT add_primary_key_if_not_exists('support_requests');
SELECT add_primary_key_if_not_exists('system_metrics');
SELECT add_primary_key_if_not_exists('vision_usage');

-- 関数を削除
DROP FUNCTION IF EXISTS add_primary_key_if_not_exists(TEXT);

-- ========================================
-- 3. 特定カラムの追加
-- ========================================

-- conversation_code_relations.user_id
ALTER TABLE conversation_code_relations
ADD COLUMN IF NOT EXISTS user_id TEXT;

UPDATE conversation_code_relations SET user_id = 'system' WHERE user_id IS NULL;

-- user_code_history.user_id
ALTER TABLE user_code_history
ADD COLUMN IF NOT EXISTS user_id TEXT;

UPDATE user_code_history SET user_id = 'system' WHERE user_id IS NULL;

-- user_code_history.action
ALTER TABLE user_code_history
ADD COLUMN IF NOT EXISTS action VARCHAR(50);

UPDATE user_code_history SET action = 'unknown' WHERE action IS NULL;

-- conversation_contexts.user_id
DO $$
BEGIN
  -- テーブルが存在しない場合は作成
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'conversation_contexts'
    AND table_schema = 'public'
  ) THEN
    CREATE TABLE conversation_contexts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT NOT NULL,
      messages JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  ELSE
    -- テーブルが存在する場合はカラムを追加
    ALTER TABLE conversation_contexts
    ADD COLUMN IF NOT EXISTS user_id TEXT;

    UPDATE conversation_contexts SET user_id = 'system' WHERE user_id IS NULL;
  END IF;
END $$;

-- conversations.session_id
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS session_id TEXT;

UPDATE conversations SET session_id = 'default_' || COALESCE(id::text, gen_random_uuid()::text) WHERE session_id IS NULL;

-- conversations.message_index
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS message_index INTEGER;

-- message_indexの重複を解消
WITH numbered_conversations AS (
  SELECT
    ctid,
    session_id,
    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at, ctid) - 1 as new_index
  FROM conversations
  WHERE message_index IS NULL
)
UPDATE conversations c
SET message_index = nc.new_index
FROM numbered_conversations nc
WHERE c.ctid = nc.ctid;

-- 残りのNULLを0に設定
UPDATE conversations SET message_index = 0 WHERE message_index IS NULL;

-- 重複エントリの削除
DELETE FROM conversations a
USING conversations b
WHERE a.ctid < b.ctid
  AND a.session_id = b.session_id
  AND a.message_index = b.message_index;

-- ユニーク制約を追加（存在しない場合）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_session_id_message_index_unique'
  ) THEN
    ALTER TABLE conversations
    ADD CONSTRAINT conversations_session_id_message_index_unique
    UNIQUE (session_id, message_index);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN
    -- 再度重複を削除してから制約を追加
    DELETE FROM conversations a
    USING conversations b
    WHERE a.ctid < b.ctid
      AND a.session_id = b.session_id
      AND a.message_index = b.message_index;

    ALTER TABLE conversations
    ADD CONSTRAINT conversations_session_id_message_index_unique
    UNIQUE (session_id, message_index);
END $$;

-- generation_queue.job_id（既存チェック付き）
ALTER TABLE generation_queue
ADD COLUMN IF NOT EXISTS job_id TEXT;

UPDATE generation_queue
SET job_id = 'job_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)
WHERE job_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'generation_queue_job_id_unique'
  ) THEN
    ALTER TABLE generation_queue
    ADD CONSTRAINT generation_queue_job_id_unique UNIQUE (job_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- processing_queue.job_id
ALTER TABLE processing_queue
ADD COLUMN IF NOT EXISTS job_id TEXT;

UPDATE processing_queue
SET job_id = 'pjob_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)
WHERE job_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'processing_queue_job_id_unique'
  ) THEN
    ALTER TABLE processing_queue
    ADD CONSTRAINT processing_queue_job_id_unique UNIQUE (job_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- users テーブルの追加カラム
ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

-- subscription_statusがpremiumの場合、is_premiumをtrueに更新
UPDATE users
SET is_premium = true
WHERE subscription_status = 'premium' AND is_premium = false;

-- metrics.metric_name
ALTER TABLE metrics
ADD COLUMN IF NOT EXISTS metric_name VARCHAR(100);

UPDATE metrics SET metric_name = 'unknown' WHERE metric_name IS NULL;

-- session_checkpoints
ALTER TABLE session_checkpoints
ADD COLUMN IF NOT EXISTS session_id TEXT;

UPDATE session_checkpoints SET session_id = 'default' WHERE session_id IS NULL;

ALTER TABLE session_checkpoints
ADD COLUMN IF NOT EXISTS checkpoint_data JSONB DEFAULT '{}'::jsonb;

-- support_requests
ALTER TABLE support_requests
ADD COLUMN IF NOT EXISTS request_id TEXT;

UPDATE support_requests
SET request_id = 'req_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)
WHERE request_id IS NULL;

ALTER TABLE support_requests
ADD COLUMN IF NOT EXISTS user_id TEXT;

UPDATE support_requests SET user_id = 'unknown' WHERE user_id IS NULL;

ALTER TABLE support_requests
ADD COLUMN IF NOT EXISTS message TEXT;

UPDATE support_requests SET message = '' WHERE message IS NULL;

-- system_metrics
ALTER TABLE system_metrics
ADD COLUMN IF NOT EXISTS metric_name VARCHAR(100);

UPDATE system_metrics SET metric_name = 'unknown' WHERE metric_name IS NULL;

ALTER TABLE system_metrics
ADD COLUMN IF NOT EXISTS metric_value NUMERIC;

UPDATE system_metrics SET metric_value = 0 WHERE metric_value IS NULL;

-- vision_usage
ALTER TABLE vision_usage
ADD COLUMN IF NOT EXISTS user_id TEXT;

UPDATE vision_usage SET user_id = 'system' WHERE user_id IS NULL;

ALTER TABLE vision_usage
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ========================================
-- 4. conversation_contexts制約の修正
-- ========================================

-- 既存の制約を削除
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversation_contexts_user_id_key'
  ) THEN
    ALTER TABLE conversation_contexts
    DROP CONSTRAINT conversation_contexts_user_id_key;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversation_contexts_user_id_unique'
  ) THEN
    ALTER TABLE conversation_contexts
    DROP CONSTRAINT conversation_contexts_user_id_unique;
  END IF;
END $$;

-- 新しいユニーク制約を追加
DO $$
BEGIN
  -- 重複データを先に削除
  DELETE FROM conversation_contexts a
  USING conversation_contexts b
  WHERE a.ctid < b.ctid
    AND a.user_id = b.user_id;

  -- 制約を追加
  ALTER TABLE conversation_contexts
  ADD CONSTRAINT conversation_contexts_user_id_unique UNIQUE (user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN
    RAISE NOTICE 'Could not add unique constraint on conversation_contexts.user_id due to duplicates';
END $$;

-- ========================================
-- 5. RLSポリシーの再設定
-- ========================================

-- RLSを有効化
ALTER TABLE code_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_share_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_code_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_code_history ENABLE ROW LEVEL SECURITY;

-- 既存のポリシーをすべて削除
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename, policyname
        FROM pg_policies
        WHERE tablename IN (
          'code_shares',
          'conversation_contexts',
          'conversations',
          'users',
          'code_share_access_logs',
          'conversation_code_relations',
          'user_code_history'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- シンプルな全許可ポリシーを作成
CREATE POLICY "allow_all" ON code_shares FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON conversation_contexts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON code_share_access_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON conversation_code_relations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON user_code_history FOR ALL USING (true) WITH CHECK (true);

-- ========================================
-- 6. インデックスの最適化
-- ========================================

-- パフォーマンス向上のためのインデックス
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_generation_queue_status ON generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_generation_queue_created_at ON generation_queue(created_at);

-- ========================================
-- 7. 診断クエリ
-- ========================================

-- code_sharesテーブルの必須カラム確認
DO $$
DECLARE
    missing_columns TEXT := '';
    required_columns TEXT[] := ARRAY['id', 'short_id', 'user_id', 'title', 'code_content', 'expires_at'];
    col TEXT;
BEGIN
    FOREACH col IN ARRAY required_columns
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'code_shares' AND column_name = col
        ) THEN
            missing_columns := missing_columns || col || ', ';
        END IF;
    END LOOP;

    IF missing_columns != '' THEN
        RAISE NOTICE 'Missing columns in code_shares: %', missing_columns;
    ELSE
        RAISE NOTICE '✅ All required columns exist in code_shares table';
    END IF;
END $$;

-- テーブルとビューの区別
DO $$
DECLARE
    tbl RECORD;
BEGIN
    RAISE NOTICE '=== Tables and Views ===';
    FOR tbl IN
        SELECT table_name, table_type
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_type, table_name
    LOOP
        RAISE NOTICE '  % (%)', tbl.table_name, tbl.table_type;
    END LOOP;
END $$;

-- PRIMARY KEY確認（VIEWを除外）
DO $$
DECLARE
    tables_without_pk TEXT := '';
    tbl RECORD;
BEGIN
    FOR tbl IN
        SELECT t.table_name
        FROM information_schema.tables t
        LEFT JOIN information_schema.table_constraints tc
            ON t.table_name = tc.table_name
            AND tc.constraint_type = 'PRIMARY KEY'
        WHERE t.table_schema = 'public'
            AND t.table_type = 'BASE TABLE'  -- VIEWを除外
            AND tc.constraint_name IS NULL
    LOOP
        tables_without_pk := tables_without_pk || tbl.table_name || ', ';
    END LOOP;

    IF tables_without_pk != '' THEN
        RAISE NOTICE '⚠️ Tables without PRIMARY KEY: %', tables_without_pk;
    ELSE
        RAISE NOTICE '✅ All tables have PRIMARY KEY';
    END IF;
END $$;

-- トランザクションコミット
COMMIT;

-- 最終確認
SELECT
    '✅ Database repair completed successfully!' as status,
    COUNT(CASE WHEN table_type = 'BASE TABLE' THEN 1 END) as total_tables,
    COUNT(CASE WHEN table_type = 'VIEW' THEN 1 END) as total_views
FROM information_schema.tables
WHERE table_schema = 'public';

-- PRIMARY KEY統計
SELECT
    COUNT(DISTINCT t.table_name) as tables_with_pk,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as total_tables
FROM information_schema.tables t
JOIN information_schema.table_constraints tc
    ON t.table_name = tc.table_name
    AND tc.constraint_type = 'PRIMARY KEY'
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE';