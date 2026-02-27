-- ドリップキャンペーン開始日時カラム追加
-- followed_at（友達追加日）とは独立して、ドリップ配信の開始タイミングを管理する
-- これにより followed_at を上書きせず、ファネル分析の正確性を保つ

ALTER TABLE users ADD COLUMN IF NOT EXISTS drip_started_at TIMESTAMPTZ;

-- インデックス: Cronジョブで drip_active=true かつ drip_started_at IS NOT NULL のユーザーを高速取得
CREATE INDEX IF NOT EXISTS idx_users_drip_active_started
  ON users (drip_active, drip_started_at)
  WHERE drip_active = true;
