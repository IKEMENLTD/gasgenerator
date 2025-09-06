-- ==========================================
-- Complete Database Fix - Remove ALL Foreign Keys & Fix Types
-- ==========================================

-- STEP 1: DROP ALL FOREIGN KEY CONSTRAINTS FIRST
-- ==========================================
-- Find and drop all foreign key constraints
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname, conrelid::regclass as table_name
        FROM pg_constraint
        WHERE contype = 'f'
        AND connamespace = 'public'::regnamespace
    )
    LOOP
        EXECUTE 'ALTER TABLE ' || r.table_name || ' DROP CONSTRAINT IF EXISTS ' || r.conname || ' CASCADE';
        RAISE NOTICE 'Dropped constraint: % on table %', r.conname, r.table_name;
    END LOOP;
END $$;

-- Specifically drop known problematic constraints
ALTER TABLE generation_queue DROP CONSTRAINT IF EXISTS generation_queue_session_id_fkey CASCADE;
ALTER TABLE generation_queue DROP CONSTRAINT IF EXISTS generation_queue_user_id_fkey CASCADE;
ALTER TABLE processing_queue DROP CONSTRAINT IF EXISTS processing_queue_session_id_fkey CASCADE;
ALTER TABLE processing_queue DROP CONSTRAINT IF EXISTS processing_queue_user_id_fkey CASCADE;
ALTER TABLE conversation_sessions DROP CONSTRAINT IF EXISTS conversation_sessions_user_id_fkey CASCADE;
ALTER TABLE conversation_states DROP CONSTRAINT IF EXISTS conversation_states_user_id_fkey CASCADE;
ALTER TABLE generated_codes DROP CONSTRAINT IF EXISTS generated_codes_user_id_fkey CASCADE;
ALTER TABLE generated_codes DROP CONSTRAINT IF EXISTS generated_codes_session_id_fkey CASCADE;
ALTER TABLE claude_usage DROP CONSTRAINT IF EXISTS claude_usage_user_id_fkey CASCADE;
ALTER TABLE claude_usage DROP CONSTRAINT IF EXISTS claude_usage_session_id_fkey CASCADE;
ALTER TABLE claude_usage_logs DROP CONSTRAINT IF EXISTS claude_usage_logs_user_id_fkey CASCADE;
ALTER TABLE payment_history DROP CONSTRAINT IF EXISTS payment_history_user_id_fkey CASCADE;

-- STEP 2: Add missing columns (if not exists)
-- ==========================================
-- generation_queue
ALTER TABLE generation_queue 
ADD COLUMN IF NOT EXISTS user_id TEXT,
ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '{}';

-- users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS line_user_id TEXT;

-- Drop unique constraint if exists and recreate
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_line_user_id_key;

-- conversation_states
ALTER TABLE conversation_states 
ADD COLUMN IF NOT EXISTS user_id_text TEXT,
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS conversation_state JSONB DEFAULT '{}';

-- generated_codes  
ALTER TABLE generated_codes 
ADD COLUMN IF NOT EXISTS user_id_text TEXT,
ADD COLUMN IF NOT EXISTS session_id_text TEXT,
ADD COLUMN IF NOT EXISTS requirements_summary TEXT,
ADD COLUMN IF NOT EXISTS generated_code TEXT,
ADD COLUMN IF NOT EXISTS explanation TEXT,
ADD COLUMN IF NOT EXISTS usage_steps TEXT,
ADD COLUMN IF NOT EXISTS code_category TEXT,
ADD COLUMN IF NOT EXISTS claude_prompt TEXT;

-- processing_queue
ALTER TABLE processing_queue 
ADD COLUMN IF NOT EXISTS user_id_text TEXT,
ADD COLUMN IF NOT EXISTS line_user_id TEXT,
ADD COLUMN IF NOT EXISTS session_id_text TEXT,
ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '{}';

-- conversation_sessions
ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS user_id_text TEXT,
ADD COLUMN IF NOT EXISTS session_id_text TEXT,
ADD COLUMN IF NOT EXISTS line_user_id TEXT,
ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]';

-- STEP 3: Convert UUID columns to TEXT
-- ==========================================

-- generation_queue.session_id (UUID to TEXT)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'generation_queue' 
        AND column_name = 'session_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE generation_queue ADD COLUMN session_id_text TEXT;
        UPDATE generation_queue SET session_id_text = session_id::TEXT WHERE session_id IS NOT NULL;
        ALTER TABLE generation_queue DROP COLUMN session_id;
        ALTER TABLE generation_queue RENAME COLUMN session_id_text TO session_id;
    END IF;
END $$;

-- processing_queue.session_id (UUID to TEXT)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'processing_queue' 
        AND column_name = 'session_id' 
        AND data_type = 'uuid'
    ) THEN
        UPDATE processing_queue SET session_id_text = session_id::TEXT WHERE session_id IS NOT NULL;
        ALTER TABLE processing_queue DROP COLUMN session_id;
        ALTER TABLE processing_queue RENAME COLUMN session_id_text TO session_id;
    END IF;
END $$;

-- conversation_sessions.session_id (UUID to TEXT)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversation_sessions' 
        AND column_name = 'session_id' 
        AND data_type = 'uuid'
    ) THEN
        UPDATE conversation_sessions SET session_id_text = session_id::TEXT WHERE session_id IS NOT NULL;
        ALTER TABLE conversation_sessions DROP COLUMN session_id;
        ALTER TABLE conversation_sessions RENAME COLUMN session_id_text TO session_id;
    END IF;
END $$;

-- generated_codes.session_id (UUID to TEXT) 
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'generated_codes' 
        AND column_name = 'session_id' 
        AND data_type = 'uuid'
    ) THEN
        UPDATE generated_codes SET session_id_text = session_id::TEXT WHERE session_id IS NOT NULL;
        ALTER TABLE generated_codes DROP COLUMN session_id;
        ALTER TABLE generated_codes RENAME COLUMN session_id_text TO session_id;
    END IF;
END $$;

-- claude_usage.session_id (UUID to TEXT)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'claude_usage' 
        AND column_name = 'session_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE claude_usage ADD COLUMN session_id_text TEXT;
        UPDATE claude_usage SET session_id_text = session_id::TEXT WHERE session_id IS NOT NULL;
        ALTER TABLE claude_usage DROP COLUMN session_id;
        ALTER TABLE claude_usage RENAME COLUMN session_id_text TO session_id;
    END IF;
END $$;

-- claude_usage.user_id (UUID to TEXT)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'claude_usage' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE claude_usage ADD COLUMN user_id_text TEXT;
        UPDATE claude_usage SET user_id_text = user_id::TEXT WHERE user_id IS NOT NULL;
        ALTER TABLE claude_usage DROP COLUMN user_id;
        ALTER TABLE claude_usage RENAME COLUMN user_id_text TO user_id;
    END IF;
END $$;

-- claude_usage_logs.user_id (UUID to TEXT)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'claude_usage_logs' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE claude_usage_logs ADD COLUMN user_id_text TEXT;
        UPDATE claude_usage_logs SET user_id_text = user_id::TEXT WHERE user_id IS NOT NULL;
        ALTER TABLE claude_usage_logs DROP COLUMN user_id;
        ALTER TABLE claude_usage_logs RENAME COLUMN user_id_text TO user_id;
    END IF;
END $$;

-- generated_codes.user_id (UUID to TEXT)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'generated_codes' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        UPDATE generated_codes SET user_id_text = user_id::TEXT WHERE user_id IS NOT NULL;
        ALTER TABLE generated_codes DROP COLUMN user_id;
        ALTER TABLE generated_codes RENAME COLUMN user_id_text TO user_id;
    END IF;
END $$;

-- conversation_states.user_id (UUID to TEXT)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversation_states' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        UPDATE conversation_states SET user_id_text = user_id::TEXT WHERE user_id IS NOT NULL;
        ALTER TABLE conversation_states DROP COLUMN user_id;
        ALTER TABLE conversation_states RENAME COLUMN user_id_text TO user_id;
    END IF;
END $$;

-- processing_queue.user_id (UUID to TEXT)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'processing_queue' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        UPDATE processing_queue SET user_id_text = user_id::TEXT WHERE user_id IS NOT NULL;
        ALTER TABLE processing_queue DROP COLUMN user_id;
        ALTER TABLE processing_queue RENAME COLUMN user_id_text TO user_id;
    END IF;
END $$;

-- conversation_sessions.user_id (UUID to TEXT)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversation_sessions' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        UPDATE conversation_sessions SET user_id_text = user_id::TEXT WHERE user_id IS NOT NULL;
        ALTER TABLE conversation_sessions DROP COLUMN user_id;
        ALTER TABLE conversation_sessions RENAME COLUMN user_id_text TO user_id;
    END IF;
END $$;

-- payment_history.user_id (UUID to TEXT)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_history' 
        AND column_name = 'user_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE payment_history ADD COLUMN user_id_text TEXT;
        UPDATE payment_history SET user_id_text = user_id::TEXT WHERE user_id IS NOT NULL;
        ALTER TABLE payment_history DROP COLUMN user_id;
        ALTER TABLE payment_history RENAME COLUMN user_id_text TO user_id;
    END IF;
END $$;

-- STEP 4: Update NULL values
-- ==========================================
UPDATE generation_queue 
SET user_id = COALESCE(line_user_id, 'system') 
WHERE user_id IS NULL;

UPDATE generation_queue 
SET session_id = gen_random_uuid()::TEXT 
WHERE session_id IS NULL;

UPDATE conversation_states 
SET user_id = 'system' 
WHERE user_id IS NULL;

UPDATE generated_codes 
SET user_id = 'system' 
WHERE user_id IS NULL;

UPDATE processing_queue 
SET user_id = COALESCE(line_user_id, 'system') 
WHERE user_id IS NULL;

UPDATE conversation_sessions 
SET user_id = COALESCE(line_user_id, 'system') 
WHERE user_id IS NULL;

-- STEP 5: Set defaults
-- ==========================================
ALTER TABLE generation_queue 
ALTER COLUMN status SET DEFAULT 'pending',
ALTER COLUMN retry_count SET DEFAULT 0,
ALTER COLUMN priority SET DEFAULT 1,
ALTER COLUMN max_retries SET DEFAULT 3;

-- STEP 6: Create indexes
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_generation_queue_user_id ON generation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_queue_line_user_id ON generation_queue(line_user_id);
CREATE INDEX IF NOT EXISTS idx_generation_queue_status ON generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_generation_queue_session_id ON generation_queue(session_id);
CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_user_id ON processing_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_codes_user_id ON generated_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id ON conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_states_user_id ON conversation_states(user_id);

-- STEP 7: Verify no foreign keys remain
-- ==========================================
SELECT 
  'Remaining foreign keys:' as check_type,
  COUNT(*) as count
FROM pg_constraint
WHERE contype = 'f'
AND connamespace = 'public'::regnamespace;

-- STEP 8: Show final structure
-- ==========================================
SELECT 
  'Final structure:' as status;

SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE column_name IN ('user_id', 'session_id', 'line_user_id', 'requirements')
  AND table_schema = 'public'
  AND table_name IN ('generation_queue', 'processing_queue', 'conversation_sessions', 'generated_codes')
ORDER BY table_name, column_name;

-- STEP 9: Test data insertion (no foreign key constraints)
-- ==========================================
INSERT INTO generation_queue (
  user_id,
  line_user_id,
  session_id,
  requirements,
  status,
  priority
) VALUES (
  'U1234567890abcdef',
  'U1234567890abcdef',
  'test_session_' || gen_random_uuid()::TEXT,
  '{"category": "gmail", "description": "Test Gmail automation"}',
  'pending',
  1
);

-- STEP 10: Show results
-- ==========================================
SELECT 
  'Migration completed! No foreign keys!' as status,
  COUNT(*) as total_records
FROM generation_queue;

SELECT 
  id,
  user_id,
  line_user_id,
  session_id,
  status,
  created_at
FROM generation_queue
ORDER BY created_at DESC
LIMIT 5;