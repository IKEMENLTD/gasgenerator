-- ===================================
-- シンプルなテストアカウント作成
-- Password: Test1234!
-- ===================================

-- もし複雑なパスワードで問題がある場合、シンプルなパスワードでテスト

-- Test1234! のbcryptハッシュ
-- $2a$10$RmTDFgQzWjQ9KgUDTBw2PeDxXWcZ5TBqjKQWz8f1KmGvNqaQ9jBSy

-- 簡単なテストアカウントを1つ作成
UPDATE agency_users
SET password_hash = '$2a$10$RmTDFgQzWjQ9KgUDTBw2PeDxXWcZ5TBqjKQWz8f1KmGvNqaQ9jBSy'
WHERE email = 'account1@test-agency.com';

-- 確認
SELECT
    email,
    name,
    password_hash
FROM agency_users
WHERE email = 'account1@test-agency.com';

-- ===================================
-- ログイン情報:
-- Email: account1@test-agency.com
-- Password: Test1234!
-- ===================================