-- ===================================
-- 登録テスト用クイックSQL
-- ===================================

-- 1. まず既存のテストデータを確認
SELECT
    'agencies' as table_name,
    COUNT(*) as record_count
FROM agencies
UNION ALL
SELECT
    'agency_users' as table_name,
    COUNT(*) as record_count
FROM agency_users;

-- 2. 最新の登録データを確認（もしあれば）
SELECT
    a.id,
    a.code,
    a.name as agency_name,
    a.company_name,
    a.status,
    a.created_at,
    au.name as owner_name,
    au.email,
    au.is_active
FROM agencies a
LEFT JOIN agency_users au ON a.id = au.agency_id AND au.role = 'owner'
ORDER BY a.created_at DESC
LIMIT 5;

-- 3. エラーの原因となりそうな重複データチェック
SELECT
    email,
    COUNT(*) as count
FROM agency_users
GROUP BY email
HAVING COUNT(*) > 1;

-- 4. 手動でテスト登録（APIテスト前の確認用）
-- 以下をコメントアウトを外して実行すれば手動テスト可能
/*
-- テスト用代理店作成
INSERT INTO agencies (
    code,
    name,
    company_name,
    contact_email,
    contact_phone,
    address,
    status,
    commission_rate
) VALUES (
    'TEST' || substr(md5(random()::text), 1, 8),
    'テスト代理店',
    '株式会社テスト',
    'test@example.com',
    '03-1234-5678',
    '東京都渋谷区',
    'pending',
    10.00
) RETURNING *;

-- テスト用ユーザー作成（上記で作成したagency_idを使用）
INSERT INTO agency_users (
    agency_id,
    email,
    password_hash,
    name,
    role,
    is_active
) VALUES (
    (SELECT id FROM agencies ORDER BY created_at DESC LIMIT 1),
    'test@example.com',
    '$2a$10$K8XqY3QqZ8PQ6RtLmHxLO.XE0Jm7xQvHPwGJG9YDqNXhG/7iZYlnO', -- password: Test123!
    'テスト太郎',
    'owner',
    false
) RETURNING *;
*/

-- 5. テーブル構造の確認
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'agencies'
ORDER BY ordinal_position;

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'agency_users'
ORDER BY ordinal_position;