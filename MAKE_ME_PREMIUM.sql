-- ========================================
-- ユーザーをプレミアムステータスに設定
-- ========================================

-- まず現在のユーザー情報を確認
SELECT
  display_name,
  subscription_status,
  is_premium,
  monthly_usage_count,
  created_at
FROM users
WHERE display_name LIKE 'U%'
ORDER BY created_at DESC
LIMIT 10;

-- ========================================
-- あなたのLINE User IDを特定してプレミアムに設定
-- ========================================

-- 方法1: 最近使用したユーザー（あなたの可能性が高い）をプレミアムに
UPDATE users
SET
  subscription_status = 'premium',
  is_premium = true,
  stripe_customer_id = 'cus_manual_premium_user',
  subscription_started_at = NOW(),
  subscription_end_date = NOW() + INTERVAL '365 days', -- 1年間有効
  monthly_usage_count = 0  -- リセット
WHERE display_name IN (
  SELECT display_name
  FROM users
  WHERE display_name LIKE 'U%'
  ORDER BY updated_at DESC
  LIMIT 1  -- 最後に使用したユーザー = あなた
);

-- ========================================
-- 特定のLINE User IDが分かっている場合
-- ========================================

-- もしあなたのLINE User IDが分かっている場合はこちらを使用
-- （LINEアプリの設定 > プロフィール > IDで確認できます）

/*
UPDATE users
SET
  subscription_status = 'premium',
  is_premium = true,
  stripe_customer_id = 'cus_manual_premium_user',
  subscription_started_at = NOW(),
  subscription_end_date = NOW() + INTERVAL '365 days',
  monthly_usage_count = 0
WHERE display_name = 'あなたのLINE_USER_ID';
*/

-- ========================================
-- 設定後の確認
-- ========================================

-- プレミアムユーザーの一覧を表示
SELECT
  display_name as line_user_id,
  subscription_status,
  is_premium,
  monthly_usage_count,
  subscription_started_at,
  subscription_end_date,
  CASE
    WHEN subscription_end_date > NOW() THEN '✅ 有効'
    ELSE '❌ 期限切れ'
  END as status
FROM users
WHERE subscription_status = 'premium'
ORDER BY subscription_started_at DESC;

-- ========================================
-- すべてのユーザーをプレミアムにする（開発用）
-- ========================================

/*
-- 開発環境ですべてのユーザーをプレミアムにしたい場合
UPDATE users
SET
  subscription_status = 'premium',
  is_premium = true,
  monthly_usage_count = 0,
  subscription_started_at = NOW(),
  subscription_end_date = NOW() + INTERVAL '365 days'
WHERE display_name LIKE 'U%';
*/

-- 完了メッセージ
SELECT
  '✅ プレミアム設定完了！' as message,
  COUNT(*) as premium_users
FROM users
WHERE subscription_status = 'premium';