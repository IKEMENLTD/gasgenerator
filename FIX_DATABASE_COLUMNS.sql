-- ========================================
-- generated_codesテーブルのカラム修正
-- ========================================

-- codeカラムが存在しない場合のみ追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'generated_codes'
    AND column_name = 'code'
  ) THEN
    ALTER TABLE generated_codes
    ADD COLUMN code TEXT;
  END IF;
END $$;

-- categoryカラムが存在しない場合のみ追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'generated_codes'
    AND column_name = 'category'
  ) THEN
    ALTER TABLE generated_codes
    ADD COLUMN category VARCHAR(50);
  END IF;
END $$;

-- ========================================
-- conversation_contextsテーブルのON CONFLICT修正
-- ========================================

-- 既存の制約を確認して、存在しない場合は追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversation_contexts_user_id_key'
  ) THEN
    ALTER TABLE conversation_contexts
    ADD CONSTRAINT conversation_contexts_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- ========================================
-- code_sharesテーブルのデータ確認と修正
-- ========================================

-- 最新のコード共有を確認
SELECT
  short_id,
  title,
  LENGTH(code_content) as code_length,
  SUBSTRING(code_content, 1, 100) as code_preview,
  created_at
FROM code_shares
ORDER BY created_at DESC
LIMIT 5;

-- 特定のshort_idのコード全体を確認（wzfwaWSmの例）
SELECT
  short_id,
  title,
  code_content,
  LENGTH(code_content) as total_length
FROM code_shares
WHERE short_id = 'wzfwaWSm';

-- もしコードが途切れていた場合の診断
-- code_contentカラムの型を確認
SELECT
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'code_shares'
AND column_name = 'code_content';