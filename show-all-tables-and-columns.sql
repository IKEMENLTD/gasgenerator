-- ==========================================
-- Show ALL Tables and Columns in Database
-- ==========================================

-- 1. すべてのテーブル一覧
SELECT 
  '========== ALL TABLES ==========' as section;

SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. すべてのテーブルとカラムの詳細
SELECT 
  '========== ALL COLUMNS BY TABLE ==========' as section;

SELECT 
  t.table_name,
  c.column_name,
  c.data_type,
  c.character_maximum_length,
  c.is_nullable,
  c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c 
  ON t.table_name = c.table_name 
  AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- 3. テーブルごとのカラム数
SELECT 
  '========== COLUMN COUNT PER TABLE ==========' as section;

SELECT 
  table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;

-- 4. プライマリキー情報
SELECT 
  '========== PRIMARY KEYS ==========' as section;

SELECT 
  tc.table_name,
  kcu.column_name as primary_key_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 5. 外部キー制約
SELECT 
  '========== FOREIGN KEYS ==========' as section;

SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public';

-- 6. インデックス一覧
SELECT 
  '========== INDEXES ==========' as section;

SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 7. テーブルのレコード数
SELECT 
  '========== RECORD COUNT ==========' as section;

DO $$
DECLARE
  r RECORD;
  sql_query TEXT;
BEGIN
  FOR r IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
  LOOP
    sql_query := format('SELECT ''%s'' as table_name, COUNT(*) as row_count FROM %I', r.table_name, r.table_name);
    BEGIN
      EXECUTE sql_query;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error counting rows in %: %', r.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- 8. 各テーブルのサイズ
SELECT 
  '========== TABLE SIZES ==========' as section;

SELECT 
  relname AS table_name,
  pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- 9. カラムのデータ型統計
SELECT 
  '========== DATA TYPE STATISTICS ==========' as section;

SELECT 
  data_type,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY data_type
ORDER BY column_count DESC;

-- 10. NULL許可カラムの統計
SELECT 
  '========== NULLABLE COLUMNS ==========' as section;

SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND is_nullable = 'YES'
ORDER BY table_name, column_name;