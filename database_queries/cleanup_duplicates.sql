-- ================================================
-- 重複セッションのクリーンアップ（段階的実行）
-- ================================================

-- 【ステップ1】重複の詳細を確認（どれを残すか判断）
SELECT
  user_id,
  id,
  status,
  (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 作成_JST,
  (updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 更新_JST,
  category,
  CASE
    WHEN messages IS NOT NULL
    THEN jsonb_array_length(messages::jsonb)
    ELSE 0
  END as メッセージ数,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, created_at DESC) as 順位
FROM conversation_sessions
WHERE user_id IN (
  SELECT user_id
  FROM conversation_sessions
  WHERE user_id IS NOT NULL
  GROUP BY user_id
  HAVING COUNT(*) > 1
)
ORDER BY user_id, 順位;


-- 【ステップ2】最新のセッションのみ残して削除（実行前に必ずステップ1の結果を確認）
-- ⚠️ このクエリは古いセッションを削除します。必ず結果を確認してから実行してください。
/*
WITH ranked_sessions AS (
  SELECT
    id,
    user_id,
    updated_at,
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


-- 【ステップ3】削除後の確認
/*
SELECT
  user_id,
  COUNT(*) as 件数
FROM conversation_sessions
WHERE user_id IS NOT NULL
GROUP BY user_id
HAVING COUNT(*) > 1;
*/

-- ステップ3で重複が0件になったことを確認したら、次のステップ4を実行


-- 【ステップ4】UNIQUE制約を追加
/*
ALTER TABLE conversation_sessions
ADD CONSTRAINT conversation_sessions_user_id_unique UNIQUE (user_id);
*/


-- 【ステップ5】最終確認
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