-- ================================================
-- user_id UNIQUE制約追加（段階的実行）
-- ================================================

-- 【ステップ1】重複データの確認
SELECT
  user_id,
  COUNT(*) as 重複数,
  STRING_AGG(id::text, ', ') as セッションID一覧,
  MAX(updated_at) as 最新更新日時
FROM conversation_sessions
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 結果を確認してから以下を実行
-- ================================================

-- 【ステップ2】重複がある場合のみ実行: 最新のみ残して古いセッションを削除
-- ⚠️ 実行前に必ずステップ1の結果を確認してください
/*
WITH ranked_sessions AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, created_at DESC) as rn
  FROM conversation_sessions
  WHERE user_id IS NOT NULL
)
DELETE FROM conversation_sessions
WHERE id IN (
  SELECT id
  FROM ranked_sessions
  WHERE rn > 1
);
*/

-- 【ステップ3】削除後の確認（重複がなくなったことを確認）
/*
SELECT
  user_id,
  COUNT(*) as 件数
FROM conversation_sessions
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 1;
*/

-- 【ステップ4】UNIQUE制約を追加
-- ⚠️ ステップ3で重複が0件になったことを確認してから実行
/*
ALTER TABLE conversation_sessions
ADD CONSTRAINT conversation_sessions_user_id_unique UNIQUE (user_id);
*/

-- 【ステップ5】インデックスを追加（パフォーマンス向上）
/*
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id
ON conversation_sessions(user_id)
WHERE user_id IS NOT NULL;
*/

-- 【ステップ6】最終確認
/*
SELECT
  conname as constraint_name,
  contype as constraint_type,
  a.attname as column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE c.conrelid = 'conversation_sessions'::regclass
  AND conname LIKE '%user_id%';
*/