-- 1. generation_queueテーブルのuser_idをTEXT型に変更し、外部キー制約を削除
ALTER TABLE generation_queue 
DROP CONSTRAINT IF EXISTS generation_queue_user_id_fkey CASCADE;

ALTER TABLE generation_queue 
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 2. ai_conversationsテーブルのuser_idをTEXT型に変更し、外部キー制約を削除
ALTER TABLE ai_conversations 
DROP CONSTRAINT IF EXISTS ai_conversations_user_id_fkey CASCADE;

ALTER TABLE ai_conversations 
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 3. generation_historyテーブルがあれば、同様に修正
ALTER TABLE generation_history 
DROP CONSTRAINT IF EXISTS generation_history_user_id_fkey CASCADE;

ALTER TABLE generation_history 
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 4. usersテーブルのidをTEXT型に変更（存在する場合）
ALTER TABLE users 
ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- 5. インデックスの再作成
DROP INDEX IF EXISTS idx_generation_queue_user_id;
CREATE INDEX idx_generation_queue_user_id ON generation_queue(user_id);

DROP INDEX IF EXISTS idx_ai_conversations_user_id;
CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);

DROP INDEX IF EXISTS idx_generation_history_user_id;
CREATE INDEX idx_generation_history_user_id ON generation_history(user_id);

-- 6. デフォルト値の設定（必要に応じて）
ALTER TABLE generation_queue ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE generation_queue ALTER COLUMN retry_count SET DEFAULT 0;
ALTER TABLE generation_queue ALTER COLUMN priority SET DEFAULT 1;

-- 7. NOT NULL制約の確認
ALTER TABLE generation_queue ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE ai_conversations ALTER COLUMN user_id SET NOT NULL;

-- 8. 既存のUUID形式のデータをLINE User ID形式に変換（必要な場合）
-- 注: 実際のLINE User IDは 'U' で始まる文字列
UPDATE generation_queue 
SET user_id = 'U' || REPLACE(user_id::text, '-', '')
WHERE user_id NOT LIKE 'U%';

UPDATE ai_conversations 
SET user_id = 'U' || REPLACE(user_id::text, '-', '')
WHERE user_id NOT LIKE 'U%';

-- 完了メッセージ
SELECT 'Schema migration completed successfully' as status;