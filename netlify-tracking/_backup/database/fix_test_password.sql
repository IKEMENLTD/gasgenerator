-- ===================================
-- 簡単なパスワードでテストアカウント修正
-- ===================================

-- アカウント1を簡単なパスワードに変更
-- Password: Test1234!
-- Hash: $2a$10$0gq4d6FAa0rbw/gSI.ZeAOfYP3uIGBkSRUGVplb5cmV5Wp5jwsCBu

UPDATE agency_users
SET password_hash = '$2a$10$0gq4d6FAa0rbw/gSI.ZeAOfYP3uIGBkSRUGVplb5cmV5Wp5jwsCBu'
WHERE email = 'account1@test-agency.com';

-- 確認
SELECT
    email,
    name,
    LEFT(password_hash, 20) as hash_prefix,
    is_active
FROM agency_users
WHERE email = 'account1@test-agency.com';

-- ===================================
-- ログイン情報:
-- URL: https://taskmateai.net/agency/
-- Email: account1@test-agency.com
-- Password: Test1234!
-- ===================================

-- デバッグ用: JWT_SECRET環境変数も設定されているか確認
-- Netlifyの環境変数に以下を追加:
-- JWT_SECRET=your-secret-key-here-at-least-32-characters-long