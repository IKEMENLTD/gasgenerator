-- ================================================
-- 【緊急修正】RLSポリシー即座に修正
-- ================================================

-- ステップ1: conversation_sessions テーブルの全RLSポリシーを削除
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'conversation_sessions'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON conversation_sessions';
    END LOOP;
END $$;

-- ステップ2: service_roleに完全な権限を付与
CREATE POLICY "service_role_all_conversation_sessions"
ON conversation_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ステップ3: 確認
SELECT
  tablename,
  policyname,
  roles
FROM pg_policies
WHERE tablename = 'conversation_sessions';