-- 無料ユーザー初回DL機能追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_download_used BOOLEAN DEFAULT false;

-- コメント追加
COMMENT ON COLUMN users.free_download_used IS '無料プランの初回DL使用済みフラグ（生涯通算1回）';
