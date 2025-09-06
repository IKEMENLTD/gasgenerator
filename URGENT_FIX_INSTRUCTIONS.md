# 🚨 緊急修正手順 - Supabaseスキーマ修正

## 問題の概要
- **UUID形式エラー**: LINE User IDがUUID形式でないため保存できない
- **外部キー制約エラー**: usersテーブルが存在しないのに参照している
- **Cron認証エラー**: undefined user_idが渡されている

## 修正手順

### 1. Supabaseダッシュボードにログイン
1. https://app.supabase.com にアクセス
2. プロジェクト「ebtcowcgkdurqdqcjrxy」を選択

### 2. SQL Editorで以下のSQLを実行

```sql
-- ステップ1: 外部キー制約を削除
ALTER TABLE generation_queue 
DROP CONSTRAINT IF EXISTS generation_queue_user_id_fkey CASCADE;

ALTER TABLE ai_conversations 
DROP CONSTRAINT IF EXISTS ai_conversations_user_id_fkey CASCADE;

ALTER TABLE generation_history 
DROP CONSTRAINT IF EXISTS generation_history_user_id_fkey CASCADE;

-- ステップ2: user_idカラムをTEXT型に変更
ALTER TABLE generation_queue 
ALTER COLUMN user_id TYPE TEXT USING COALESCE(user_id::TEXT, '');

ALTER TABLE ai_conversations 
ALTER COLUMN user_id TYPE TEXT USING COALESCE(user_id::TEXT, '');

ALTER TABLE generation_history 
ALTER COLUMN user_id TYPE TEXT USING COALESCE(user_id::TEXT, '');

-- ステップ3: インデックスを再作成
DROP INDEX IF EXISTS idx_generation_queue_user_id;
CREATE INDEX idx_generation_queue_user_id ON generation_queue(user_id);

DROP INDEX IF EXISTS idx_ai_conversations_user_id;
CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);

-- ステップ4: デフォルト値を設定
ALTER TABLE generation_queue 
ALTER COLUMN status SET DEFAULT 'pending',
ALTER COLUMN retry_count SET DEFAULT 0,
ALTER COLUMN priority SET DEFAULT 1;

-- 確認
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name IN ('generation_queue', 'ai_conversations', 'generation_history')
  AND column_name = 'user_id';
```

### 3. 確認クエリ

```sql
-- 制約が削除されたか確認
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS foreign_table
FROM pg_constraint
WHERE contype = 'f' 
  AND conrelid::regclass::text IN ('generation_queue', 'ai_conversations', 'generation_history');
```

## 実行後の確認

1. Renderのログを確認
2. LINEボットでメッセージを送信してテスト
3. エラーが解消されていることを確認

## エラーが続く場合

もしエラーが続く場合は、以下も実行：

```sql
-- NULL値を処理
UPDATE generation_queue SET user_id = 'unknown' WHERE user_id IS NULL OR user_id = '';
UPDATE ai_conversations SET user_id = 'unknown' WHERE user_id IS NULL OR user_id = '';

-- NOT NULL制約を追加
ALTER TABLE generation_queue ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE ai_conversations ALTER COLUMN user_id SET NOT NULL;
```