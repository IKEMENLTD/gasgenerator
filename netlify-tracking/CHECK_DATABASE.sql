-- Supabase で実行してください
-- 作成されたトラッキングリンクを確認

SELECT
    id,
    tracking_code,
    name,
    is_active,
    visit_count,
    line_friend_url,
    destination_url,
    created_at
FROM agency_tracking_links
ORDER BY created_at DESC
LIMIT 10;

-- 特定のトラッキングコードで検索
-- SELECT * FROM agency_tracking_links WHERE tracking_code = 'ここにコードを入れる';
