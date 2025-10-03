-- ================================================
-- データベース書き込み失敗の原因調査
-- ================================================

-- 【1】processing_queueに溜まっているジョブ（過去7日）
SELECT
  pq.status,
  COUNT(*) as 件数,
  pq.error_message,
  MAX((pq.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp) as 最新_JST
FROM processing_queue pq
WHERE pq.created_at > NOW() - INTERVAL '7 days'
GROUP BY pq.status, pq.error_message
ORDER BY 最新_JST DESC;


-- 【2】過去7日の全processing_queue詳細
SELECT
  pq.id,
  pq.user_id,
  pq.status,
  pq.error_message,
  pq.retry_count,
  (pq.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 作成_JST
FROM processing_queue pq
WHERE pq.created_at > NOW() - INTERVAL '7 days'
ORDER BY pq.created_at DESC
LIMIT 50;


-- 【3】9/26以降のusersテーブル更新
SELECT
  u.line_user_id,
  u.display_name,
  (u.last_active_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 最終利用_JST,
  (u.updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 更新_JST,
  u.total_requests,
  u.monthly_usage_count
FROM users u
WHERE u.updated_at > '2025-09-26 10:07:40+00'
ORDER BY u.updated_at DESC;


-- 【4】9/26以降のgenerated_codes
SELECT
  gc.user_id,
  gc.category,
  (gc.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 生成_JST
FROM generated_codes gc
WHERE gc.created_at > '2025-09-26 10:07:40+00'
ORDER BY gc.created_at DESC
LIMIT 20;


-- 【5】データベース接続とパーミッション確認
-- 現在のロールと権限
SELECT current_user, session_user;

-- テーブルへの書き込み権限確認
SELECT
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE grantee = current_user
  AND table_schema = 'public'
  AND table_name IN ('conversation_sessions', 'users', 'processing_queue', 'generated_codes')
ORDER BY table_name, privilege_type;


-- 【6】Row Level Security (RLS) ポリシー確認
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('conversation_sessions', 'users', 'processing_queue', 'generated_codes')
ORDER BY tablename, policyname;


-- 【7】テーブルロック状況
SELECT
  locktype,
  relation::regclass,
  mode,
  granted,
  pid
FROM pg_locks
WHERE relation::regclass::text IN ('conversation_sessions', 'users', 'processing_queue', 'generated_codes')
ORDER BY relation;


-- 【8】最近のエラーログ（もしログテーブルがあれば）
-- SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 20;


-- 【9】Supabase認証関連のユーザー情報
SELECT
  id,
  email,
  (last_sign_in_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 最終ログイン_JST,
  (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo')::timestamp as 登録_JST
FROM auth.users
ORDER BY last_sign_in_at DESC
LIMIT 10;


-- 【10】テーブルサイズと統計情報
SELECT
  schemaname,
  relname as table_name,
  n_live_tup as row_count,
  n_dead_tup as dead_rows,
  last_autovacuum,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE relname IN ('conversation_sessions', 'users', 'processing_queue', 'generated_codes')
ORDER BY relname;


-- ================================================
-- 【重要】書き込みテスト
-- ================================================

-- テストセッションを作成してみる（実行前に確認）
/*
INSERT INTO conversation_sessions (user_id, status, messages)
VALUES (
  'test-user-id-' || NOW()::text,
  'test',
  '[]'::jsonb
);
*/

-- 作成できたか確認
/*
SELECT * FROM conversation_sessions WHERE status = 'test' ORDER BY created_at DESC LIMIT 1;
*/

-- テストデータ削除
/*
DELETE FROM conversation_sessions WHERE status = 'test';
*/