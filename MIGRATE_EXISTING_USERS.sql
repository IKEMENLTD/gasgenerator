-- =====================================
-- 既存ユーザーのデータ移行
-- display_name → line_user_id への移行
-- =====================================
-- 実行日: 2025-01-19
-- 重要: この移行を実行しないと既存ユーザーが決済できません
-- =====================================

-- 1. 現在の状況を確認
SELECT
  COUNT(*) as total_users,
  COUNT(CASE WHEN line_user_id IS NOT NULL THEN 1 END) as has_line_user_id,
  COUNT(CASE WHEN line_user_id IS NULL AND display_name LIKE 'U%' THEN 1 END) as needs_migration
FROM users;

-- 2. 移行が必要なユーザーを表示（確認用）
SELECT
  id,
  line_user_id,
  display_name,
  subscription_status,
  created_at
FROM users
WHERE line_user_id IS NULL
  AND display_name LIKE 'U%'
  AND LENGTH(display_name) = 33
LIMIT 10;

-- 3. データ移行を実行
-- display_nameがLINE ID形式（U + 32文字の16進数）の場合、line_user_idに移動
UPDATE users
SET
  line_user_id = display_name,
  display_name = line_display_name,  -- LINE表示名があればdisplay_nameに移動
  updated_at = NOW()
WHERE line_user_id IS NULL
  AND display_name ~ '^U[0-9a-f]{32}$';  -- LINE IDの正規表現パターン

-- 4. 移行結果を確認
SELECT
  COUNT(*) as migrated_users
FROM users
WHERE line_user_id ~ '^U[0-9a-f]{32}$';

-- 5. 重複チェック（line_user_idは一意である必要がある）
SELECT
  line_user_id,
  COUNT(*) as count
FROM users
WHERE line_user_id IS NOT NULL
GROUP BY line_user_id
HAVING COUNT(*) > 1;

-- =====================================
-- 重要な注意事項
-- =====================================
-- 1. このSQLを実行する前に必ずバックアップを取得してください
-- 2. 移行後、新規ユーザーは正しくline_user_idに保存されます
-- 3. 既存の有料ユーザーがいる場合は、特に注意して実行してください