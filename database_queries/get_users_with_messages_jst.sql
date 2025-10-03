-- ================================================
-- ユーザー一覧とメッセージ内容取得（日本時間対応版）
-- ================================================

-- ★★★ 最も使いやすいクエリ ★★★
-- 直近30人のユーザーとメッセージ内容を日本時間で表示

WITH latest_sessions AS (
  SELECT
    cs.user_id::text as user_id_text,
    cs.messages,
    cs.category,
    cs.status,
    cs.updated_at,
    ROW_NUMBER() OVER (PARTITION BY cs.user_id ORDER BY cs.updated_at DESC) as rn
  FROM conversation_sessions cs
  WHERE cs.messages IS NOT NULL
)

SELECT
  u.line_user_id,
  u.display_name,
  u.line_display_name,
  u.is_premium,
  u.subscription_status,
  u.monthly_usage_count as 今月利用,
  u.total_requests as 累計利用,

  -- 日本時間に変換
  (u.last_active_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 最終利用日時_JST,

  -- 最後のメッセージ
  ls.messages::jsonb -> -1 ->> 'content' as 最後のメッセージ,

  ls.category as カテゴリ,
  ls.status as セッション状態,

  -- 会話日時も日本時間
  (ls.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 会話日時_JST,

  -- 相対時間
  CASE
    WHEN (NOW() - u.last_active_at) < INTERVAL '1 hour' THEN '1時間以内'
    WHEN (NOW() - u.last_active_at) < INTERVAL '1 day' THEN '今日'
    WHEN (NOW() - u.last_active_at) < INTERVAL '2 days' THEN '昨日'
    WHEN (NOW() - u.last_active_at) < INTERVAL '7 days' THEN
      EXTRACT(DAY FROM NOW() - u.last_active_at)::text || '日前'
    ELSE TO_CHAR(u.last_active_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo', 'YYYY/MM/DD')
  END as 相対時間

FROM users u
LEFT JOIN latest_sessions ls ON ls.user_id_text = u.line_user_id AND ls.rn = 1

ORDER BY u.last_active_at DESC NULLS LAST

LIMIT 30;


-- ================================================
-- プレミアム設定手順
-- ================================================

-- ステップ1: line_user_id で検索
SELECT
  line_user_id,
  display_name,
  line_display_name,
  is_premium,
  subscription_status,
  monthly_usage_count,
  (last_active_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 最終利用_JST
FROM users
WHERE line_user_id = 'U1234567890abcdef';  -- ← ここに実際のIDを入れる


-- ステップ2: プレミアムに設定
UPDATE users
SET
  is_premium = true,
  subscription_status = 'active',
  subscription_started_at = NOW(),
  subscription_end_date = NOW() + INTERVAL '1 month',
  monthly_usage_count = 0,
  updated_at = NOW()
WHERE line_user_id = 'U1234567890abcdef';  -- ← ここに実際のIDを入れる


-- ステップ3: 確認
SELECT
  line_user_id,
  display_name,
  line_display_name,
  is_premium,
  subscription_status,
  (subscription_started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 開始日_JST,
  (subscription_end_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 終了日_JST,
  monthly_usage_count
FROM users
WHERE line_user_id = 'U1234567890abcdef';  -- ← ここに実際のIDを入れる