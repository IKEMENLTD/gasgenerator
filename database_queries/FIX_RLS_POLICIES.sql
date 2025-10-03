-- ================================================
-- RLSポリシー修正スクリプト
-- ================================================

-- 【重要】このスクリプトはSupabase SQL Editorで実行してください

-- ================================================
-- ステップ1: 現在のRLSポリシーを確認
-- ================================================
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('conversation_sessions', 'users', 'generated_codes', 'processing_queue')
ORDER BY tablename, policyname;


-- ================================================
-- ステップ2: 既存のRLSポリシーを削除
-- ================================================
-- conversation_sessions
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON conversation_sessions;
DROP POLICY IF EXISTS "Enable read access for all users" ON conversation_sessions;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON conversation_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON conversation_sessions;
DROP POLICY IF EXISTS "Users can read their own sessions" ON conversation_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON conversation_sessions;

-- users
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable read access for all users" ON users;
DROP POLICY IF EXISTS "Enable update for users based on line_user_id" ON users;
DROP POLICY IF EXISTS "Users can insert themselves" ON users;
DROP POLICY IF EXISTS "Users can read their own data" ON users;
DROP POLICY IF EXISTS "Users can update themselves" ON users;

-- generated_codes
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON generated_codes;
DROP POLICY IF EXISTS "Enable read access for all users" ON generated_codes;

-- processing_queue
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON processing_queue;
DROP POLICY IF EXISTS "Enable read access for all users" ON processing_queue;


-- ================================================
-- ステップ3: サービスロール用の新しいポリシーを作成
-- ================================================

-- conversation_sessions: サービスロールに全権限
CREATE POLICY "Service role full access on conversation_sessions"
ON conversation_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- users: サービスロールに全権限
CREATE POLICY "Service role full access on users"
ON users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- generated_codes: サービスロールに全権限
CREATE POLICY "Service role full access on generated_codes"
ON generated_codes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- processing_queue: サービスロールに全権限
CREATE POLICY "Service role full access on processing_queue"
ON processing_queue
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- line_profiles: サービスロールに全権限
CREATE POLICY "Service role full access on line_profiles"
ON line_profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ================================================
-- ステップ4: RLSを有効化（既に有効の場合はスキップされる）
-- ================================================
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_profiles ENABLE ROW LEVEL SECURITY;


-- ================================================
-- ステップ5: 確認クエリ
-- ================================================
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('conversation_sessions', 'users', 'generated_codes', 'processing_queue', 'line_profiles')
ORDER BY tablename, policyname;