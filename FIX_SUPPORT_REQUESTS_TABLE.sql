-- support_requestsテーブルに不足しているカラムを追加
-- 既存のテーブル構造を確認して、必要なカラムのみ追加

-- 1. user_idカラムを追加（存在しない場合）
ALTER TABLE support_requests 
ADD COLUMN IF NOT EXISTS user_id VARCHAR(255) NOT NULL DEFAULT '';

-- 2. messageカラムを追加（存在しない場合）
ALTER TABLE support_requests 
ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '';

-- 3. idカラムを追加（存在しない場合）
ALTER TABLE support_requests 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT uuid_generate_v4();

-- 4. idをプライマリキーに設定（まだ設定されていない場合）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'support_requests_pkey'
    ) THEN
        ALTER TABLE support_requests ADD PRIMARY KEY (id);
    END IF;
END $$;

-- 5. インデックスを作成（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_support_requests_user_id 
ON support_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_support_requests_status 
ON support_requests(status);

CREATE INDEX IF NOT EXISTS idx_support_requests_created_at 
ON support_requests(created_at DESC);

-- 6. デフォルト値の修正
ALTER TABLE support_requests 
ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE support_requests 
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE support_requests 
ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- 7. updated_atの自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 既存のトリガーを削除して再作成
DROP TRIGGER IF EXISTS update_support_requests_updated_at ON support_requests;

CREATE TRIGGER update_support_requests_updated_at 
BEFORE UPDATE ON support_requests 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 8. 確認用クエリ
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'support_requests'
ORDER BY ordinal_position;