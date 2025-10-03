-- ================================================
-- UNIQUE制約とインデックスの確認
-- ================================================ii

-- 【1】conversation_sessionsテーブルの制約確認
SELECT
  conname as constraint_name,
  contype as constraint_type,
  a.attname as column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE c.conrelid = 'conversation_sessions'::regclass
ORDER BY conname;

-- 【2】conversation_sessionsのインデックス確認
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'conversation_sessions';

-- 【3】テーブル構造確認
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'conversation_sessions'
ORDER BY ordinal_position;