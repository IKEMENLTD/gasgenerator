-- ================================================
-- コード生成機能の状態確認
-- ================================================

-- 【1】generated_codesの全履歴（削除されたものも含めて確認）
SELECT
  gc.id,
  gc.user_id,
  gc.category,
  gc.code_category,
  LENGTH(gc.code) as コード長,
  (gc.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 生成日時_JST
FROM generated_codes gc
ORDER BY gc.created_at DESC
LIMIT 50;


-- 【2】conversation_sessionsのカテゴリ分布
SELECT
  cs.category,
  cs.status,
  COUNT(*) as 件数,
  MAX((cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp) as 最終更新_JST
FROM conversation_sessions cs
GROUP BY cs.category, cs.status
ORDER BY 最終更新_JST DESC;


-- 【3】メッセージが実際に入っているセッション
SELECT
  cs.id,
  cs.user_id::text,
  cs.category,
  cs.status,
  (cs.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 作成_JST,
  (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 更新_JST,
  CASE
    WHEN cs.messages IS NOT NULL
    THEN jsonb_array_length(cs.messages::jsonb)
    ELSE 0
  END as メッセージ数,
  CASE
    WHEN cs.messages IS NOT NULL AND jsonb_array_length(cs.messages::jsonb) > 0
    THEN cs.messages::jsonb -> 0 ->> 'content'
  END as 最初のメッセージ,
  CASE
    WHEN cs.messages IS NOT NULL AND jsonb_array_length(cs.messages::jsonb) > 0
    THEN cs.messages::jsonb -> -1 ->> 'content'
  END as 最後のメッセージ
FROM conversation_sessions cs
WHERE cs.messages IS NOT NULL
ORDER BY cs.updated_at DESC
LIMIT 20;


-- 【4】アクティブなセッションの詳細
SELECT
  cs.id,
  cs.user_id::text,
  cs.status,
  (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 更新_JST,
  NOW() - cs.updated_at as 経過時間
FROM conversation_sessions cs
WHERE cs.status = 'active'
ORDER BY cs.updated_at DESC;


-- 【5】最近削除されたと思われるデータの痕跡
-- dead_rowsが多いのに実際のデータが少ないテーブルを確認
SELECT
  'generated_codes' as テーブル名,
  COUNT(*) as 現在のレコード数,
  'dead_rows: 21' as 備考
FROM generated_codes

UNION ALL

SELECT
  'conversation_sessions' as テーブル名,
  COUNT(*) as 現在のレコード数,
  'dead_rows: 57' as 備考
FROM conversation_sessions;


-- 【6】usersテーブルの利用カウント
SELECT
  u.line_user_id,
  u.display_name,
  u.total_requests,
  u.monthly_usage_count,
  u.is_premium,
  (u.last_active_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 最終利用_JST,
  (u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 登録_JST
FROM users u
WHERE u.total_requests > 0 OR u.monthly_usage_count > 0
ORDER BY u.last_active_at DESC;


-- 【7】環境変数テーブルがあれば確認
-- SELECT * FROM system_config;
-- SELECT * FROM app_settings;


-- 【8】Webhook受信ログ（もしテーブルがあれば）
-- SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 20;


-- 【9】APIリクエストログ（もしテーブルがあれば）
-- SELECT * FROM api_logs ORDER BY created_at DESC LIMIT 20;


-- 【10】トリガーとファンクションの確認
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('conversation_sessions', 'generated_codes', 'processing_queue')
ORDER BY event_object_table, trigger_name;