-- ========================================
-- LINE表示名を自動保存できるようにするSQL
-- ========================================

-- ========================================
-- 1. LINE APIから表示名を取得する関数（プレースホルダー）
-- ========================================

-- LINE表示名を更新するための関数
CREATE OR REPLACE FUNCTION update_line_display_name()
RETURNS TRIGGER AS $$
BEGIN
  -- conversation_sessionsテーブルから表示名を取得して更新
  -- （セッション作成時にLINE APIから取得した表示名が入る想定）
  IF NEW.line_display_name IS NULL THEN
    -- conversation_sessionsのmetadataやmessagesから表示名を探す
    SELECT
      COALESCE(
        (messages->0->>'displayName')::text,
        (collected_requirements->>'userName')::text,
        (extracted_requirements->>'userName')::text
      ) INTO NEW.line_display_name
    FROM conversation_sessions
    WHERE user_id = NEW.display_name
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. usersテーブル更新時のトリガー
-- ========================================

-- 既存のトリガーを削除（存在する場合）
DROP TRIGGER IF EXISTS update_line_display_name_trigger ON users;

-- 新しいトリガーを作成
CREATE TRIGGER update_line_display_name_trigger
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_line_display_name();

-- ========================================
-- 3. conversation_sessionsからusersへ表示名を同期する関数
-- ========================================

CREATE OR REPLACE FUNCTION sync_line_display_names()
RETURNS void AS $$
DECLARE
  rec RECORD;
BEGIN
  -- conversation_sessionsから表示名情報を抽出して更新
  FOR rec IN
    SELECT DISTINCT ON (cs.user_id)
      cs.user_id,
      (cs.messages->0->>'displayName')::text as display_name_from_message,
      (cs.collected_requirements->>'userName')::text as name_from_requirements,
      (cs.extracted_requirements->>'userName')::text as name_from_extracted
    FROM conversation_sessions cs
    WHERE cs.user_id IS NOT NULL
    ORDER BY cs.user_id, cs.created_at DESC
  LOOP
    UPDATE users
    SET line_display_name = COALESCE(
      rec.display_name_from_message,
      rec.name_from_requirements,
      rec.name_from_extracted,
      line_display_name
    )
    WHERE display_name = rec.user_id
    AND line_display_name IS NULL;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. APIレスポンスから表示名を保存するためのテーブル
-- ========================================

CREATE TABLE IF NOT EXISTS line_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT,
  picture_url TEXT,
  status_message TEXT,
  language TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_line_profiles_user_id ON line_profiles(user_id);

-- ========================================
-- 5. LINE APIからの表示名を保存する関数
-- ========================================

CREATE OR REPLACE FUNCTION save_line_profile(
  p_user_id TEXT,
  p_display_name TEXT,
  p_picture_url TEXT DEFAULT NULL,
  p_status_message TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- line_profilesテーブルに保存
  INSERT INTO line_profiles (
    user_id,
    display_name,
    picture_url,
    status_message,
    fetched_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_display_name,
    p_picture_url,
    p_status_message,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    picture_url = EXCLUDED.picture_url,
    status_message = EXCLUDED.status_message,
    updated_at = NOW();

  -- usersテーブルも更新
  UPDATE users
  SET
    line_display_name = p_display_name,
    updated_at = NOW()
  WHERE display_name = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 6. 既存ユーザーの表示名を同期
-- ========================================

-- conversation_sessionsから表示名を取得して更新
SELECT sync_line_display_names();

-- line_profilesテーブルから表示名を同期
UPDATE users u
SET line_display_name = lp.display_name
FROM line_profiles lp
WHERE u.display_name = lp.user_id
AND u.line_display_name IS NULL;

-- ========================================
-- 7. アプリケーション側で使用する例
-- ========================================

-- LINE APIから表示名を取得した時に呼び出す
-- SELECT save_line_profile('U67796fffcdb5fa48e8f3316ff1c418e3', 'あなたの名前');

-- ========================================
-- 8. 手動で表示名を設定する場合
-- ========================================

-- 特定ユーザーの表示名を手動設定
/*
UPDATE users
SET line_display_name = 'お名前'
WHERE display_name = 'U67796fffcdb5fa48e8f3316ff1c418e3';
*/

-- ========================================
-- 9. 表示名の取得状況を確認
-- ========================================

SELECT
  display_name as LINE_ID,
  line_display_name as LINE表示名,
  subscription_status as プラン,
  last_active_at as 最終利用,
  CASE
    WHEN line_display_name IS NOT NULL THEN '✅ 取得済'
    ELSE '❌ 未取得'
  END as 表示名ステータス
FROM users
ORDER BY last_active_at DESC NULLS LAST
LIMIT 20;

-- ========================================
-- 10. ビューを作成して簡単にアクセス
-- ========================================

CREATE OR REPLACE VIEW user_profiles AS
SELECT
  u.display_name as line_id,
  COALESCE(u.line_display_name, lp.display_name, '未設定') as display_name,
  u.subscription_status,
  u.is_premium,
  u.last_active_at,
  u.monthly_usage_count,
  lp.picture_url,
  lp.status_message
FROM users u
LEFT JOIN line_profiles lp ON u.display_name = lp.user_id
ORDER BY u.last_active_at DESC;

-- 使用例：
-- SELECT * FROM user_profiles WHERE line_id = 'U67796fffcdb5fa48e8f3316ff1c418e3';