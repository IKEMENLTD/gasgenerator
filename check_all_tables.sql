-- ========================================
-- 全テーブルとカラムを確認するSQL
-- ========================================

-- 1. 全テーブル一覧を表示
SELECT 
  table_name,
  table_type
FROM 
  information_schema.tables 
WHERE 
  table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY 
  table_name;

-- 2. usersテーブルの全カラム
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM 
  information_schema.columns
WHERE 
  table_name = 'users'
ORDER BY 
  ordinal_position;

-- 3. conversation_sessionsテーブルの全カラム（存在する場合）
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM 
  information_schema.columns
WHERE 
  table_name = 'conversation_sessions'
ORDER BY 
  ordinal_position;

-- 4. generation_queueテーブルの全カラム（存在する場合）
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM 
  information_schema.columns
WHERE 
  table_name = 'generation_queue'
ORDER BY 
  ordinal_position;

-- 5. generated_codesテーブルの全カラム（存在する場合）
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM 
  information_schema.columns
WHERE 
  table_name = 'generated_codes'
ORDER BY 
  ordinal_position;

-- 6. claude_usageテーブルの全カラム（存在する場合）
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM 
  information_schema.columns
WHERE 
  table_name = 'claude_usage'
ORDER BY 
  ordinal_position;

-- 7. metricsテーブルの全カラム（存在する場合）
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM 
  information_schema.columns
WHERE 
  table_name = 'metrics'
ORDER BY 
  ordinal_position;

-- 8. payment_historyテーブルの全カラム（存在する場合）
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM 
  information_schema.columns
WHERE 
  table_name = 'payment_history'
ORDER BY 
  ordinal_position;

-- ========================================
-- 統合版：全テーブルの全カラムを一度に表示
-- ========================================
SELECT 
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default,
  c.ordinal_position
FROM 
  information_schema.tables t
  JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE 
  t.table_schema = 'public' 
  AND t.table_type = 'BASE TABLE'
  AND t.table_name IN (
    'users',
    'conversation_sessions',
    'generation_queue',
    'generated_codes',
    'claude_usage',
    'metrics',
    'payment_history'
  )
ORDER BY 
  t.table_name,
  c.ordinal_position;

-- ========================================
-- 必要なテーブルの存在チェック
-- ========================================
WITH required_tables AS (
  SELECT unnest(ARRAY[
    'users',
    'conversation_sessions',
    'generation_queue',
    'generated_codes',
    'claude_usage',
    'metrics',
    'payment_history'
  ]) AS table_name
),
existing_tables AS (
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
)
SELECT 
  rt.table_name,
  CASE 
    WHEN et.table_name IS NOT NULL THEN '✅ 存在'
    ELSE '❌ 不足'
  END AS status
FROM required_tables rt
LEFT JOIN existing_tables et ON rt.table_name = et.table_name
ORDER BY rt.table_name;