-- 007_download_limits.sql
-- ダウンロード回数制限用カラム追加
-- 1万円プラン(premium): 月1回 / 5万円プラン(professional): 月3回

-- usersテーブルにダウンロード回数管理カラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_download_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS download_reset_month TEXT DEFAULT '';

-- インデックス（月次リセット確認の高速化）
CREATE INDEX IF NOT EXISTS idx_users_download_reset_month ON users(download_reset_month);
