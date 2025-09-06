-- ==========================================
-- Production Hotfix for gas-generator
-- Date: 2025-09-06
-- Issues Fixed:
-- 1. UUID format errors
-- 2. Foreign key constraint violations
-- 3. NULL user_id handling
-- ==========================================

-- STEP 1: Remove foreign key constraints from generation_queue
-- ==========================================
ALTER TABLE generation_queue 
DROP CONSTRAINT IF EXISTS generation_queue_user_id_fkey CASCADE;

-- STEP 2: Convert generation_queue user_id to TEXT type
-- ==========================================
ALTER TABLE generation_queue 
ALTER COLUMN user_id TYPE TEXT USING COALESCE(user_id::TEXT, 'unknown');

-- STEP 3: Update NULL and empty values in generation_queue
-- ==========================================
UPDATE generation_queue 
SET user_id = 'unknown' 
WHERE user_id IS NULL OR user_id = '';

-- STEP 4: Add NOT NULL constraint to generation_queue
-- ==========================================
ALTER TABLE generation_queue 
ALTER COLUMN user_id SET NOT NULL;

-- STEP 5: Set proper defaults for generation_queue
-- ==========================================
ALTER TABLE generation_queue 
ALTER COLUMN status SET DEFAULT 'pending',
ALTER COLUMN retry_count SET DEFAULT 0,
ALTER COLUMN priority SET DEFAULT 1,
ALTER COLUMN created_at SET DEFAULT NOW();

-- STEP 6: Recreate indexes for performance
-- ==========================================
DROP INDEX IF EXISTS idx_generation_queue_user_id;
CREATE INDEX idx_generation_queue_user_id ON generation_queue(user_id);

DROP INDEX IF EXISTS idx_generation_queue_status;
CREATE INDEX idx_generation_queue_status ON generation_queue(status);

DROP INDEX IF EXISTS idx_generation_queue_created_at;
CREATE INDEX idx_generation_queue_created_at ON generation_queue(created_at DESC);

-- STEP 7: Handle generation_history if it exists
-- ==========================================
DO $$ 
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'generation_history'
  ) THEN
    -- Remove foreign key constraint
    ALTER TABLE generation_history 
    DROP CONSTRAINT IF EXISTS generation_history_user_id_fkey CASCADE;
    
    -- Convert to TEXT
    ALTER TABLE generation_history 
    ALTER COLUMN user_id TYPE TEXT USING COALESCE(user_id::TEXT, 'unknown');
    
    -- Update NULL values
    UPDATE generation_history 
    SET user_id = 'unknown' 
    WHERE user_id IS NULL OR user_id = '';
    
    -- Add NOT NULL constraint
    ALTER TABLE generation_history 
    ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- STEP 8: Clean up old stuck jobs
-- ==========================================
UPDATE generation_queue 
SET status = 'failed',
    error_message = 'Stuck job cleaned up'
WHERE status = 'processing' 
  AND created_at < NOW() - INTERVAL '1 hour';

-- STEP 9: Verify the changes
-- ==========================================
SELECT 
  'generation_queue' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'generation_queue'
  AND column_name = 'user_id';

-- STEP 10: Check for any remaining foreign key constraints
-- ==========================================
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS foreign_table
FROM pg_constraint
WHERE contype = 'f' 
  AND conrelid::regclass::text = 'generation_queue';

-- STEP 11: Show current queue status
-- ==========================================
SELECT 
  'Migration completed!' as status,
  COUNT(*) as total_queue_items,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_items,
  COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_items,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_items,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_items
FROM generation_queue;

-- STEP 12: Show sample of current data
-- ==========================================
SELECT 
  id,
  user_id,
  status,
  created_at
FROM generation_queue
ORDER BY created_at DESC
LIMIT 5;