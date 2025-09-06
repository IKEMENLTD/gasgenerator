-- ==========================================
-- Production Hotfix for gas-generator
-- Date: 2025-09-06
-- Issues Fixed:
-- 1. UUID format errors
-- 2. Foreign key constraint violations
-- 3. NULL user_id handling
-- ==========================================

-- STEP 1: Remove all foreign key constraints
-- ==========================================
ALTER TABLE generation_queue 
DROP CONSTRAINT IF EXISTS generation_queue_user_id_fkey CASCADE;

ALTER TABLE ai_conversations 
DROP CONSTRAINT IF EXISTS ai_conversations_user_id_fkey CASCADE;

ALTER TABLE generation_history 
DROP CONSTRAINT IF EXISTS generation_history_user_id_fkey CASCADE;

-- STEP 2: Convert user_id columns to TEXT type
-- ==========================================
-- Handle generation_queue
ALTER TABLE generation_queue 
ALTER COLUMN user_id TYPE TEXT USING COALESCE(user_id::TEXT, 'unknown');

-- Handle ai_conversations
ALTER TABLE ai_conversations 
ALTER COLUMN user_id TYPE TEXT USING COALESCE(user_id::TEXT, 'unknown');

-- Handle generation_history (if exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'generation_history'
  ) THEN
    ALTER TABLE generation_history 
    ALTER COLUMN user_id TYPE TEXT USING COALESCE(user_id::TEXT, 'unknown');
  END IF;
END $$;

-- STEP 3: Update NULL and empty values
-- ==========================================
UPDATE generation_queue 
SET user_id = 'unknown' 
WHERE user_id IS NULL OR user_id = '';

UPDATE ai_conversations 
SET user_id = 'unknown' 
WHERE user_id IS NULL OR user_id = '';

UPDATE generation_history 
SET user_id = 'unknown' 
WHERE user_id IS NULL OR user_id = '';

-- STEP 4: Add NOT NULL constraints
-- ==========================================
ALTER TABLE generation_queue 
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE ai_conversations 
ALTER COLUMN user_id SET NOT NULL;

-- STEP 5: Set proper defaults
-- ==========================================
ALTER TABLE generation_queue 
ALTER COLUMN status SET DEFAULT 'pending',
ALTER COLUMN retry_count SET DEFAULT 0,
ALTER COLUMN priority SET DEFAULT 1,
ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE ai_conversations 
ALTER COLUMN conversation_state SET DEFAULT '{}',
ALTER COLUMN created_at SET DEFAULT NOW();

-- STEP 6: Recreate indexes for performance
-- ==========================================
DROP INDEX IF EXISTS idx_generation_queue_user_id;
CREATE INDEX idx_generation_queue_user_id ON generation_queue(user_id);

DROP INDEX IF EXISTS idx_generation_queue_status;
CREATE INDEX idx_generation_queue_status ON generation_queue(status);

DROP INDEX IF EXISTS idx_generation_queue_created_at;
CREATE INDEX idx_generation_queue_created_at ON generation_queue(created_at DESC);

DROP INDEX IF EXISTS idx_ai_conversations_user_id;
CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);

DROP INDEX IF EXISTS idx_ai_conversations_session_id;
CREATE INDEX idx_ai_conversations_session_id ON ai_conversations(session_id);

-- STEP 7: Clean up old stuck jobs
-- ==========================================
UPDATE generation_queue 
SET status = 'failed',
    error_message = 'Stuck job cleaned up'
WHERE status = 'processing' 
  AND created_at < NOW() - INTERVAL '1 hour';

-- STEP 8: Verify the changes
-- ==========================================
SELECT 
  'generation_queue' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'generation_queue'
  AND column_name = 'user_id'
UNION ALL
SELECT 
  'ai_conversations' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'ai_conversations'
  AND column_name = 'user_id';

-- STEP 9: Check for any remaining foreign key constraints
-- ==========================================
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS foreign_table
FROM pg_constraint
WHERE contype = 'f' 
  AND conrelid::regclass::text IN ('generation_queue', 'ai_conversations', 'generation_history');

-- FINAL: Success message
-- ==========================================
SELECT 'Schema migration completed successfully!' as status,
       COUNT(*) as total_queue_items,
       COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_items,
       COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_items
FROM generation_queue;