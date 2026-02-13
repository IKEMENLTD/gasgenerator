-- 006: agency_conversions テーブルにデバイス情報カラムを追加
-- 目的: 代理店ダッシュボードでLINE名前とデバイス情報を表示可能にする
--
-- 前提: schema.sql で visit_id, line_display_name は既に定義済み
--       device_type, browser, os は未定義のため追加が必要
--
-- デプロイ順序: このSQLを実行した後にコードをデプロイすること

-- 1. デバイス情報カラム追加（これが本当に必要な変更）
ALTER TABLE agency_conversions
ADD COLUMN IF NOT EXISTS device_type VARCHAR(50);

ALTER TABLE agency_conversions
ADD COLUMN IF NOT EXISTS browser VARCHAR(50);

ALTER TABLE agency_conversions
ADD COLUMN IF NOT EXISTS os VARCHAR(50);

-- 2. 念のため既存カラムも IF NOT EXISTS で確認（schema.sql未適用環境向け）
ALTER TABLE agency_conversions
ADD COLUMN IF NOT EXISTS line_display_name VARCHAR(255);

ALTER TABLE agency_conversions
ADD COLUMN IF NOT EXISTS visit_id UUID;

-- 3. インデックス追加
CREATE INDEX IF NOT EXISTS idx_agency_conversions_visit_id
ON agency_conversions(visit_id);

CREATE INDEX IF NOT EXISTS idx_agency_conversions_line_user_id
ON agency_conversions(line_user_id);

-- 4. 既存データの backfill（テーブル存在チェック付き）
DO $$
BEGIN
  -- line_profiles テーブルが存在する場合のみ、LINE表示名を補完
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'line_profiles'
  ) THEN
    UPDATE agency_conversions ac
    SET line_display_name = lp.display_name
    FROM line_profiles lp
    WHERE ac.line_user_id = lp.user_id
      AND ac.line_display_name IS NULL
      AND lp.display_name IS NOT NULL;

    RAISE NOTICE 'line_profiles からの backfill 完了';
  ELSE
    RAISE NOTICE 'line_profiles テーブルが存在しないため backfill スキップ';
  END IF;

  -- session_id カラムが両テーブルに存在する場合のみ、デバイス情報を補完
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_conversions' AND column_name = 'session_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agency_tracking_visits' AND column_name = 'session_id'
  ) THEN
    UPDATE agency_conversions ac
    SET
      device_type = atv.device_type,
      browser = atv.browser,
      os = atv.os,
      visit_id = COALESCE(ac.visit_id, atv.id)
    FROM agency_tracking_visits atv
    WHERE ac.session_id IS NOT NULL
      AND atv.session_id::text = ac.session_id::text
      AND ac.device_type IS NULL;

    RAISE NOTICE 'tracking_visits からのデバイス情報 backfill 完了';
  ELSE
    RAISE NOTICE 'session_id カラムが見つからないため デバイス backfill スキップ';
  END IF;
END $$;
