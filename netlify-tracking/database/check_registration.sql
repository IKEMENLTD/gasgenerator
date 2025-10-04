-- ===================================
-- 新規登録データ確認用SQL
-- ===================================

-- 1. 最近登録された代理店を確認
SELECT
    id,
    code,
    name,
    company_name,
    contact_email,
    status,
    created_at
FROM agencies
ORDER BY created_at DESC
LIMIT 5;

-- 2. 最近登録されたユーザーを確認
SELECT
    au.id,
    au.email,
    au.name,
    au.role,
    au.is_active,
    au.created_at,
    a.name as agency_name,
    a.code as agency_code
FROM agency_users au
LEFT JOIN agencies a ON au.agency_id = a.id
ORDER BY au.created_at DESC
LIMIT 5;

-- 3. 今日登録されたデータをカウント
SELECT
    COUNT(*) as total_registrations_today
FROM agency_users
WHERE DATE(created_at) = CURRENT_DATE;

-- 4. エラーログ確認用（もしログテーブルがある場合）
-- SELECT * FROM error_logs WHERE created_at > NOW() - INTERVAL '1 hour';

-- 5. 特定のメールアドレスで検索
-- SELECT * FROM agency_users WHERE email = 'test-new@agency.com';