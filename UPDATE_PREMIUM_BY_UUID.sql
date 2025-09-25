-- ========================================
-- ユーザー確認とプレミアムプラン変更SQL
-- ========================================

-- ========================================
-- 1. ユーザーリストを確認（LINE表示名を取得できる場合）
-- ========================================

-- まずLINE表示名カラムを追加（存在しない場合）
ALTER TABLE users
ADD COLUMN IF NOT EXISTS line_display_name TEXT;

-- ユーザーリストを表示
SELECT
  ROW_NUMBER() OVER (ORDER BY last_active_at DESC NULLS LAST) as 順位,
  id as UUID,
  display_name as LINE_ID,
  COALESCE(
    line_display_name,
    CASE
      WHEN display_name LIKE 'U%' THEN 'LINEユーザー(' || LEFT(display_name, 10) || '...)'
      ELSE display_name
    END
  ) as LINE名または識別子,
  subscription_status as プラン,
  is_premium as プレミアム,
  last_active_at as 最終利用,
  monthly_usage_count as 今月の使用回数,
  created_at as 登録日,
  CASE
    WHEN last_active_at > NOW() - INTERVAL '1 hour' THEN '🟢 1時間以内'
    WHEN last_active_at > NOW() - INTERVAL '1 day' THEN '🔵 今日'
    WHEN last_active_at > NOW() - INTERVAL '7 days' THEN '🟡 今週'
    WHEN last_active_at > NOW() - INTERVAL '30 days' THEN '🟠 今月'
    ELSE '⚪ それ以前'
  END as 活動状況,
  CASE
    WHEN monthly_usage_count >= 100 THEN '⚡ ヘビーユーザー'
    WHEN monthly_usage_count >= 50 THEN '🔥 アクティブ'
    WHEN monthly_usage_count >= 10 THEN '👤 通常利用'
    ELSE '💤 ライト'
  END as 利用頻度
FROM users
ORDER BY last_active_at DESC NULLS LAST
LIMIT 20;

-- ========================================
-- 2. UUID指定でプレミアムプランに変更
-- ========================================

-- 使い方: 'YOUR_UUID_HERE'を実際のUUIDに置き換えて実行
UPDATE users
SET
  subscription_status = 'premium',
  is_premium = true,
  stripe_customer_id = 'cus_manual_premium_' || id,
  subscription_started_at = NOW(),
  subscription_end_date = NOW() + INTERVAL '365 days',
  monthly_usage_count = 0,
  updated_at = NOW()
WHERE id = 'YOUR_UUID_HERE';  -- ← ここにUUIDを入力

-- ========================================
-- 3. UUID指定でプロフェッショナルプランに変更
-- ========================================

-- 使い方: 'YOUR_UUID_HERE'を実際のUUIDに置き換えて実行
UPDATE users
SET
  subscription_status = 'professional',
  is_premium = true,
  stripe_customer_id = 'cus_manual_professional_' || id,
  subscription_started_at = NOW(),
  subscription_end_date = NOW() + INTERVAL '365 days',
  monthly_usage_count = 0,
  updated_at = NOW()
WHERE id = 'YOUR_UUID_HERE';  -- ← ここにUUIDを入力

-- ========================================
-- 4. 複数のUUIDを一括でプレミアムに変更
-- ========================================

-- 複数のユーザーを一括変更する場合
UPDATE users
SET
  subscription_status = 'premium',
  is_premium = true,
  stripe_customer_id = 'cus_manual_premium_' || id,
  subscription_started_at = NOW(),
  subscription_end_date = NOW() + INTERVAL '365 days',
  monthly_usage_count = 0,
  updated_at = NOW()
WHERE id IN (
  'UUID_1_HERE',
  'UUID_2_HERE',
  'UUID_3_HERE'
);

-- ========================================
-- 5. 変更結果を確認
-- ========================================

-- 特定のUUIDのプラン状況を確認
SELECT
  id as UUID,
  display_name as LINE_ID,
  subscription_status as プラン,
  is_premium as プレミアム,
  subscription_started_at as 開始日,
  subscription_end_date as 終了日,
  CASE
    WHEN subscription_end_date > NOW() THEN '✅ 有効'
    ELSE '❌ 期限切れ'
  END as ステータス,
  monthly_usage_count as 使用回数,
  stripe_customer_id as 顧客ID
FROM users
WHERE id = 'YOUR_UUID_HERE'  -- ← 確認したいUUIDを入力
ORDER BY updated_at DESC;

-- ========================================
-- 6. プレミアムユーザー全体の確認
-- ========================================

SELECT
  COUNT(*) FILTER (WHERE subscription_status = 'free') as 無料プラン,
  COUNT(*) FILTER (WHERE subscription_status = 'premium') as プレミアム,
  COUNT(*) FILTER (WHERE subscription_status = 'professional') as プロフェッショナル,
  COUNT(*) as 合計ユーザー数
FROM users;

-- ========================================
-- 7. 簡単な一行変更コマンド（コピペ用）
-- ========================================

-- プレミアムに変更（UUIDを置き換えて実行）
UPDATE users SET subscription_status = 'premium', is_premium = true, subscription_started_at = NOW(), subscription_end_date = NOW() + INTERVAL '365 days', monthly_usage_count = 0 WHERE id = 'YOUR_UUID_HERE';

-- プロフェッショナルに変更（UUIDを置き換えて実行）
UPDATE users SET subscription_status = 'professional', is_premium = true, subscription_started_at = NOW(), subscription_end_date = NOW() + INTERVAL '365 days', monthly_usage_count = 0 WHERE id = 'YOUR_UUID_HERE';

-- 無料プランに戻す（UUIDを置き換えて実行）
UPDATE users SET subscription_status = 'free', is_premium = false, subscription_end_date = NULL WHERE id = 'YOUR_UUID_HERE';