-- ========================================
-- エラー修正 & デザイン改善用SQL
-- ========================================

-- 1. conversation_contexts テーブルの制約修正
-- テーブルが存在する場合のみ処理
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'conversation_contexts'
  ) THEN
    -- 既存の制約を削除
    ALTER TABLE conversation_contexts
    DROP CONSTRAINT IF EXISTS conversation_contexts_user_id_key;

    -- 新しいユニーク制約を追加
    ALTER TABLE conversation_contexts
    ADD CONSTRAINT conversation_contexts_user_id_key UNIQUE (user_id);
  ELSE
    -- テーブルが存在しない場合は作成
    CREATE TABLE conversation_contexts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      messages JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  END IF;
END $$;

-- 2. generated_codes テーブルに gas_url カラムを追加
ALTER TABLE generated_codes
ADD COLUMN IF NOT EXISTS gas_url TEXT;

-- インデックスも追加
CREATE INDEX IF NOT EXISTS idx_generated_codes_gas_url
ON generated_codes(gas_url)
WHERE gas_url IS NOT NULL;

-- 3. メモリ使用量改善のための古いデータクリーンアップ
-- code_share_access_logsテーブルにcreated_atカラムを追加（存在しない場合）
ALTER TABLE code_share_access_logs
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- 30日以上前のアクセスログを削除（カラムが存在する場合のみ）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'code_share_access_logs'
    AND column_name = 'created_at'
  ) THEN
    DELETE FROM code_share_access_logs
    WHERE created_at < NOW() - INTERVAL '30 days';
  END IF;
END $$;

-- 期限切れのコード共有を論理削除
UPDATE code_shares
SET is_deleted = true, deletion_reason = 'expired'
WHERE expires_at < NOW()
AND is_deleted = false;

-- 4. パフォーマンス改善のためのインデックス追加
CREATE INDEX IF NOT EXISTS idx_conversations_user_id
ON conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_session_id
ON conversations(session_id);

-- 5. 統計情報の更新
ANALYZE code_shares;
ANALYZE generated_codes;
ANALYZE conversation_contexts;
ANALYZE conversations;

-- 完了メッセージ
SELECT 'エラー修正完了。次はデザイン改善を実装します。' as message;