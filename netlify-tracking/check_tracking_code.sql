-- Supabase SQL Editorで実行してください
-- トラッキングコード 'ewyaoak0g2py' を検索

SELECT
    id,
    tracking_code,
    name,
    is_active,
    agency_id,
    visit_count,
    line_friend_url,
    destination_url,
    created_at
FROM agency_tracking_links
WHERE tracking_code = 'ewyaoak0g2py';

-- 結果が空の場合、トラッキングコードがDBに存在しません
-- 結果がある場合、is_active が true か確認してください
