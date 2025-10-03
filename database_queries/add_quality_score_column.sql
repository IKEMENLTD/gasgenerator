-- ================================================
-- generated_codes テーブルに quality_score カラムを追加
-- ================================================

-- 【1】現在のカラム構成を確認
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'generated_codes'
ORDER BY ordinal_position;


-- 【2】quality_score カラムを追加
ALTER TABLE generated_codes
ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0;


-- 【3】確認
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'generated_codes'
  AND column_name = 'quality_score';