-- ================================================
-- 実際のデータ状況を確認（修正版）
-- ================================================

-- 【1】データベースの現在時刻
SELECT
  NOW() as DB現在時刻_UTC,
  (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 現在時刻_JST,
  CURRENT_DATE as 現在日付_UTC,
  (NOW() AT TIME ZONE 'Asia/Tokyo')::date as 現在日付_JST;


-- 【2】最新のセッション（上位10件）
SELECT
  cs.user_id::text as user_id,
  (cs.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 作成_JST,
  (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 更新_JST,
  cs.status,
  cs.messages IS NOT NULL as メッセージ有,
  CASE
    WHEN cs.messages IS NOT NULL
    THEN jsonb_array_length(cs.messages::jsonb)
  END as メッセージ数

FROM conversation_sessions cs

ORDER BY cs.updated_at DESC

LIMIT 10;


-- 【3】users テーブルの最新更新
SELECT
  line_user_id,
  display_name,
  (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 登録_JST,
  (last_active_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 最終利用_JST,
  (updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 更新_JST,
  total_requests,
  monthly_usage_count

FROM users

ORDER BY updated_at DESC

LIMIT 10;


-- 【4】日付別セッション数（過去7日）
SELECT
  (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::date as 日付_JST,
  COUNT(*) as セッション数,
  COUNT(*) FILTER (WHERE cs.messages IS NOT NULL) as メッセージ有セッション,
  COUNT(DISTINCT cs.user_id) as ユニークユーザー

FROM conversation_sessions cs

WHERE cs.updated_at > NOW() - INTERVAL '7 days'

GROUP BY (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::date

ORDER BY 日付_JST DESC;


-- 【5】processing_queue の状態
SELECT
  pq.status,
  COUNT(*) as 件数,
  MIN((pq.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp) as 最古_JST,
  MAX((pq.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp) as 最新_JST

FROM processing_queue pq

WHERE pq.created_at > NOW() - INTERVAL '7 days'

GROUP BY pq.status

ORDER BY 最新_JST DESC NULLS LAST;


-- 【6】generated_codes の最新（user_id のみ使用）
SELECT
  gc.user_id,
  (gc.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 生成_JST,
  gc.category,
  gc.code_category

FROM generated_codes gc

WHERE gc.created_at > NOW() - INTERVAL '7 days'

ORDER BY gc.created_at DESC

LIMIT 10;


-- 【7】システムが動いているか確認
SELECT
  'セッション' as テーブル,
  COUNT(*) as 総レコード数,
  MAX((updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp) as 最新更新_JST,
  NOW() - MAX(updated_at) as 経過時間

FROM conversation_sessions

UNION ALL

SELECT
  'ユーザー' as テーブル,
  COUNT(*) as 総レコード数,
  MAX((last_active_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp) as 最新更新_JST,
  NOW() - MAX(last_active_at) as 経過時間

FROM users

UNION ALL

SELECT
  'コード生成' as テーブル,
  COUNT(*) as 総レコード数,
  MAX((created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp) as 最新更新_JST,
  NOW() - MAX(created_at) as 経過時間

FROM generated_codes

UNION ALL

SELECT
  'キュー' as テーブル,
  COUNT(*) as 総レコード数,
  MAX((created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp) as 最新更新_JST,
  NOW() - MAX(created_at) as 経過時間

FROM processing_queue;


-- 【8】9月の全データ確認
SELECT
  EXTRACT(DAY FROM (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')) as 日,
  COUNT(*) as セッション数

FROM conversation_sessions cs

WHERE (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo') >= '2025-09-01'
  AND (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo') < '2025-10-01'

GROUP BY EXTRACT(DAY FROM (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo'))

ORDER BY 日 DESC;


-- 【9】LINEプロフィールテーブル確認
SELECT
  COUNT(*) as レコード数,
  MAX((fetched_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp) as 最終取得_JST

FROM line_profiles;


-- 【10】結論：システムの健全性
SELECT
  '===== システム状態 =====' as チェック項目,
  CASE
    WHEN MAX(cs.updated_at) < NOW() - INTERVAL '4 days' THEN
      '🔴 過去4日間データなし。LINE Botが使われていないか、Webhookが停止している可能性'
    WHEN MAX(cs.updated_at) < NOW() - INTERVAL '2 days' THEN
      '🟡 過去2日間データなし。確認推奨'
    WHEN MAX(cs.updated_at) < NOW() - INTERVAL '1 day' THEN
      '🟠 過去24時間データなし'
    ELSE
      '✅ 正常に動作中'
  END as ステータス,

  MAX((cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp) as 最新アクティビティ_JST,

  NOW() - MAX(cs.updated_at) as 最終アクティビティからの経過時間

FROM conversation_sessions cs;


-- ================================================
-- 簡易版：すぐに確認
-- ================================================

-- 過去30日の日別アクティビティ
SELECT
  (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::date as 日付,
  COUNT(*) as セッション数,
  COUNT(DISTINCT cs.user_id) as ユーザー数

FROM conversation_sessions cs

WHERE cs.updated_at > NOW() - INTERVAL '30 days'

GROUP BY (cs.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::date

ORDER BY 日付 DESC;


-- ================================================
-- 最もシンプルな確認
-- ================================================

-- 最新10件
SELECT
  (updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 日時_JST,
  user_id::text,
  status

FROM conversation_sessions

ORDER BY updated_at DESC

LIMIT 10;