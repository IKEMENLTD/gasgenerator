-- 会話状態の永続化テーブル
CREATE TABLE IF NOT EXISTS conversation_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  context JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_conversation_states_user_id ON conversation_states(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_states_expires_at ON conversation_states(expires_at);

-- 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_states_updated_at
  BEFORE UPDATE ON conversation_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 期限切れデータの自動削除（オプション）
-- Supabaseの定期実行機能またはcronで実行
CREATE OR REPLACE FUNCTION cleanup_expired_conversations()
RETURNS void AS $$
BEGIN
  DELETE FROM conversation_states
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- コメント
COMMENT ON TABLE conversation_states IS 'LINEボットの会話状態を一時的に保存';
COMMENT ON COLUMN conversation_states.user_id IS 'LINE User ID';
COMMENT ON COLUMN conversation_states.context IS '会話コンテキスト（JSON形式）';
COMMENT ON COLUMN conversation_states.expires_at IS 'データの有効期限';