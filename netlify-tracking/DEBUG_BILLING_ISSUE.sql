-- 🔍 課金情報が表示されない問題のデバッグSQL
-- Supabase SQL Editorで実行してください

-- ============================================
-- STEP 1: usersテーブルの構造を確認
-- ============================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- ============================================
-- STEP 2: 代理店情報を確認（あなたの代理店ID）
-- ============================================
-- まず、ログインしている代理店のIDを確認
SELECT
    id,
    code,
    name,
    status,
    commission_rate
FROM agencies
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- STEP 3: コンバージョンデータを確認
-- ============================================
-- 代理店IDを上記の結果から取得して、以下のXXXを置き換えてください
-- SELECT * FROM agency_conversions WHERE agency_id = 'XXX';

-- 全代理店のコンバージョンを確認（デバッグ用）
SELECT
    ac.id,
    ac.agency_id,
    ac.user_id,
    ac.conversion_type,
    ac.conversion_value,
    ac.line_user_id,
    ac.line_display_name,
    ac.created_at
FROM agency_conversions ac
ORDER BY ac.created_at DESC
LIMIT 20;

-- ============================================
-- STEP 4: user_idが存在するコンバージョンを確認
-- ============================================
SELECT
    COUNT(*) as total_conversions,
    COUNT(user_id) as conversions_with_user_id,
    COUNT(line_user_id) as conversions_with_line_user_id
FROM agency_conversions;

-- ============================================
-- STEP 5: usersテーブルのデータを確認
-- ============================================
SELECT
    id,
    line_user_id,
    display_name,
    line_display_name,
    subscription_status,
    subscription_started_at,
    is_premium,
    stripe_customer_id,
    created_at
FROM users
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- STEP 6: コンバージョンとユーザーのJOIN確認
-- ============================================
SELECT
    ac.id as conversion_id,
    ac.conversion_type,
    ac.user_id,
    ac.line_user_id as conversion_line_user_id,
    u.id as user_table_id,
    u.line_user_id as user_table_line_user_id,
    u.display_name,
    u.subscription_status,
    u.is_premium
FROM agency_conversions ac
LEFT JOIN users u ON ac.user_id = u.id
ORDER BY ac.created_at DESC
LIMIT 20;

-- ============================================
-- STEP 7: 特定の代理店の課金ユーザーを確認
-- ============================================
-- 代理店IDを指定（XXXを実際のIDに置き換え）
/*
SELECT
    ac.agency_id,
    ac.user_id,
    u.display_name,
    u.subscription_status,
    u.is_premium,
    u.stripe_customer_id,
    ac.conversion_type,
    ac.conversion_value
FROM agency_conversions ac
INNER JOIN users u ON ac.user_id = u.id
WHERE ac.agency_id = 'XXX'
  AND ac.user_id IS NOT NULL
ORDER BY ac.created_at DESC;
*/

-- ============================================
-- STEP 8: LINE友達追加のフロー確認
-- ============================================
-- 代理店登録 → LINE友達追加 → ユーザー作成の流れを確認
SELECT
    'Agencies' as table_name,
    a.id,
    a.name,
    a.status,
    a.line_user_id,
    a.created_at
FROM agencies a
WHERE a.line_user_id IS NOT NULL
ORDER BY a.created_at DESC
LIMIT 5;

-- ============================================
-- STEP 9: トラッキングリンクとコンバージョンの関連
-- ============================================
SELECT
    atl.agency_id,
    atl.name as link_name,
    atl.tracking_code,
    atl.visit_count,
    atl.conversion_count,
    COUNT(ac.id) as actual_conversions
FROM agency_tracking_links atl
LEFT JOIN agency_conversions ac ON atl.id = ac.tracking_link_id
GROUP BY atl.id, atl.agency_id, atl.name, atl.tracking_code, atl.visit_count, atl.conversion_count
ORDER BY atl.created_at DESC
LIMIT 10;

-- ============================================
-- STEP 10: 問題の診断
-- ============================================
-- 以下の結果から問題を特定:

-- A) コンバージョンデータがない場合:
--    → ユーザーがまだ課金していない、またはStripe Webhookが動作していない

-- B) コンバージョンはあるがuser_idがNULLの場合:
--    → Stripe Webhookでuser_idが正しく記録されていない
--    → metadata.user_idが設定されていない

-- C) user_idはあるがusersテーブルにデータがない場合:
--    → 外部キー制約の問題
--    → usersテーブルへのINSERTが失敗している

-- D) usersテーブルにデータはあるがsubscription_statusがNULLまたは'free'の場合:
--    → Stripe Webhookでusersテーブルが更新されていない
--    → 別のテーブルに課金情報が記録されている可能性
