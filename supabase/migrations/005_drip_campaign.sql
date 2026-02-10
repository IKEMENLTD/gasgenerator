-- Migration 005: ドリップキャンペーン
ALTER TABLE users ADD COLUMN IF NOT EXISTS followed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS drip_step INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS drip_active BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS drip_stopped_reason TEXT;

UPDATE users SET followed_at = COALESCE(created_at, NOW()) WHERE followed_at IS NULL;

CREATE TABLE IF NOT EXISTS drip_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  step INTEGER NOT NULL,
  message_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_drip_logs_user ON drip_logs(line_user_id);
CREATE INDEX IF NOT EXISTS idx_drip_logs_sent ON drip_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_users_drip_active ON users(drip_active) WHERE drip_active = true;
CREATE INDEX IF NOT EXISTS idx_users_followed_at ON users(followed_at);
