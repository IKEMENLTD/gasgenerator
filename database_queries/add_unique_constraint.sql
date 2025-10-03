-- ================================================
-- user_id に UNIQUE制約を追加
-- ================================================

-- ステップ1: 重複データの確認
SELECT
  user_id,
  COUNT(*) as 件数
FROM conversation_sessions
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 1;

-- ステップ2: 重複がある場合は最新のみ残して削除
-- （実行前に結果を確認してください）
/*
DELETE FROM conversation_sessions
WHERE id NOT IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC) as rn
    FROM conversation_sessions
    WHERE user_id IS NOT NULL
  ) sub
  WHERE rn = 1
);
*/

-- ステップ3: UNIQUE制約を追加
-- ALTER TABLE conversation_sessions
-- ADD CONSTRAINT conversation_sessions_user_id_unique UNIQUE (user_id);

-- ステップ4: インデックスを追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id
ON conversation_sessions(user_id);

-- ステップ5: 確認
SELECT
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'conversation_sessions'::regclass;