-- ================================================
-- 9/30 データ徹底調査
-- ================================================

-- 【1】9/30の全セッション（メッセージなしも含む）
SELECT
  cs.id,
  cs.user_id::text,
  (cs.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 作成_JST,
  (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 更新_JST,
  cs.status,
  cs.category,
  cs.messages IS NOT NULL as メッセージ有,
  CASE
    WHEN cs.messages IS NOT NULL
    THEN jsonb_array_length(cs.messages::jsonb)
    ELSE 0
  END as メッセージ数

FROM conversation_sessions cs

WHERE (cs.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::date = '2025-09-30'
   OR (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::date = '2025-09-30'

ORDER BY cs.updated_at DESC;


-- 【2】9/30のユーザーアクティビティ
SELECT
  u.line_user_id,
  u.display_name,
  u.line_display_name,
  (u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 登録_JST,
  (u.last_active_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 最終利用_JST,
  (u.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 更新_JST,
  u.total_requests,
  u.monthly_usage_count

FROM users u

WHERE (u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::date = '2025-09-30'
   OR (u.last_active_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::date = '2025-09-30'
   OR (u.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::date = '2025-09-30'

ORDER BY u.updated_at DESC;


-- 【3】9/30のprocessing_queue（失敗したジョブも）
SELECT
  pq.id,
  pq.user_id,
  pq.session_id,
  pq.status,
  pq.error_message,
  (pq.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 作成_JST

FROM processing_queue pq

WHERE (pq.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::date = '2025-09-30'

ORDER BY pq.created_at DESC;


-- 【4】9/30のコード生成履歴
SELECT
  gc.id,
  gc.user_id,
  gc.category,
  gc.code_category,
  (gc.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 生成_JST

FROM generated_codes gc

WHERE (gc.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::date = '2025-09-30'

ORDER BY gc.created_at DESC;


-- 【5】9/30のLINEプロフィール取得
SELECT
  lp.user_id,
  lp.display_name,
  lp.picture_url,
  (lp.fetched_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 取得_JST

FROM line_profiles lp

WHERE (lp.fetched_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::date = '2025-09-30'

ORDER BY lp.fetched_at DESC;


-- 【6】9/29と9/30の比較（境界チェック）
SELECT
  '9/29' as 日付,
  COUNT(*) as セッション数,
  COUNT(DISTINCT cs.user_id) as ユニークユーザー,
  COUNT(*) FILTER (WHERE cs.messages IS NOT NULL) as メッセージ有

FROM conversation_sessions cs

WHERE (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::date = '2025-09-29'

UNION ALL

SELECT
  '9/30' as 日付,
  COUNT(*) as セッション数,
  COUNT(DISTINCT cs.user_id) as ユニークユーザー,
  COUNT(*) FILTER (WHERE cs.messages IS NOT NULL) as メッセージ有

FROM conversation_sessions cs

WHERE (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::date = '2025-09-30';


-- 【7】9/30 UTC時刻でのデータ確認（タイムゾーン変換前）
SELECT
  cs.id,
  cs.user_id::text,
  cs.created_at as 作成_UTC,
  cs.updated_at as 更新_UTC,
  (cs.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 作成_JST,
  (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 更新_JST,
  cs.status

FROM conversation_sessions cs

WHERE cs.updated_at::date = '2025-09-30'

ORDER BY cs.updated_at DESC;


-- 【8】最新30件のセッション（時刻詳細表示）
SELECT
  cs.user_id::text,
  cs.updated_at as UTC時刻,
  (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as JST時刻,
  cs.status,
  cs.messages IS NOT NULL as メッセージ有

FROM conversation_sessions cs

ORDER BY cs.updated_at DESC

LIMIT 30;


-- 【9】データベースの現在時刻確認
SELECT
  NOW() as DB現在時刻_UTC,
  (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 現在時刻_JST,
  NOW()::date as 現在日付_UTC,
  (NOW() AT TIME ZONE 'Asia/Tokyo')::date as 現在日付_JST;


-- 【10】9/30以降の全データ
SELECT
  (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 更新日時_JST,
  cs.user_id::text,
  cs.status,
  cs.messages IS NOT NULL as メッセージ有

FROM conversation_sessions cs

WHERE (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo') >= '2025-09-30 00:00:00'

ORDER BY cs.updated_at DESC;