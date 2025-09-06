-- ==========================================
-- Complete Database Fix - Handle All UUID Issues
-- ==========================================

-- STEP 1: Check existing column types
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name = 'user_id'
  AND table_schema = 'public'
ORDER BY table_name;

-- STEP 2: Add missing TEXT columns (won't affect UUID columns)
-- generation_queue
ALTER TABLE generation_queue 
ADD COLUMN IF NOT EXISTS user_id TEXT;

ALTER TABLE generation_queue 
ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '{}';

-- users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS line_user_id TEXT UNIQUE;

-- conversation_states
ALTER TABLE conversation_states 
ADD COLUMN IF NOT EXISTS user_id_text TEXT,
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS conversation_state JSONB DEFAULT '{}';

-- generated_codes  
ALTER TABLE generated_codes 
ADD COLUMN IF NOT EXISTS user_id_text TEXT,
ADD COLUMN IF NOT EXISTS session_id TEXT,
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
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '{}';

-- conversation_sessions
ALTER TABLE conversation_sessions 
ADD COLUMN IF NOT EXISTS user_id_text TEXT,
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS line_user_id TEXT,
ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]';

-- STEP 3: Handle tables with UUID user_id columns
-- For generated_codes (if user_id is UUID)
DO $$
BEGIN
  -- Check if user_id is UUID type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'generated_codes' 
    AND column_name = 'user_id' 
    AND data_type = 'uuid'
  ) THEN
    -- Copy UUID data to text column
    UPDATE generated_codes 
    SET user_id_text = user_id::TEXT 
    WHERE user_id IS NOT NULL;
    
    -- Drop UUID column and rename text column
    ALTER TABLE generated_codes DROP COLUMN user_id;
    ALTER TABLE generated_codes RENAME COLUMN user_id_text TO user_id;
  END IF;
END $$;

-- For conversation_states (if user_id is UUID)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_states' 
    AND column_name = 'user_id' 
    AND data_type = 'uuid'
  ) THEN
    UPDATE conversation_states 
    SET user_id_text = user_id::TEXT 
    WHERE user_id IS NOT NULL;
    
    ALTER TABLE conversation_states DROP COLUMN user_id;
    ALTER TABLE conversation_states RENAME COLUMN user_id_text TO user_id;
  END IF;
END $$;

-- For processing_queue (if user_id is UUID)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'processing_queue' 
    AND column_name = 'user_id' 
    AND data_type = 'uuid'
  ) THEN
    UPDATE processing_queue 
    SET user_id_text = user_id::TEXT 
    WHERE user_id IS NOT NULL;
    
    ALTER TABLE processing_queue DROP COLUMN user_id;
    ALTER TABLE processing_queue RENAME COLUMN user_id_text TO user_id;
  END IF;
END $$;

-- For conversation_sessions (if user_id is UUID)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_sessions' 
    AND column_name = 'user_id' 
    AND data_type = 'uuid'
  ) THEN
    UPDATE conversation_sessions 
    SET user_id_text = user_id::TEXT 
    WHERE user_id IS NOT NULL;
    
    ALTER TABLE conversation_sessions DROP COLUMN user_id;
    ALTER TABLE conversation_sessions RENAME COLUMN user_id_text TO user_id;
  END IF;
END $$;

-- For claude_usage (if user_id is UUID)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claude_usage' 
    AND column_name = 'user_id' 
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE claude_usage ADD COLUMN IF NOT EXISTS user_id_text TEXT;
    UPDATE claude_usage SET user_id_text = user_id::TEXT WHERE user_id IS NOT NULL;
    ALTER TABLE claude_usage DROP COLUMN user_id;
    ALTER TABLE claude_usage RENAME COLUMN user_id_text TO user_id;
  END IF;
END $$;

-- For claude_usage_logs (if user_id is UUID)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'claude_usage_logs' 
    AND column_name = 'user_id' 
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE claude_usage_logs ADD COLUMN IF NOT EXISTS user_id_text TEXT;
    UPDATE claude_usage_logs SET user_id_text = user_id::TEXT WHERE user_id IS NOT NULL;
    ALTER TABLE claude_usage_logs DROP COLUMN user_id;
    ALTER TABLE claude_usage_logs RENAME COLUMN user_id_text TO user_id;
  END IF;
END $$;

-- STEP 4: Update NULL values (only for TEXT columns now)
UPDATE generation_queue 
SET user_id = COALESCE(line_user_id, 'system') 
WHERE user_id IS NULL;

UPDATE conversation_states 
SET user_id = 'system' 
WHERE user_id IS NULL AND EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'conversation_states' 
  AND column_name = 'user_id' 
  AND data_type = 'text'
);

UPDATE generated_codes 
SET user_id = 'system' 
WHERE user_id IS NULL AND EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'generated_codes' 
  AND column_name = 'user_id' 
  AND data_type = 'text'
);

UPDATE processing_queue 
SET user_id = COALESCE(line_user_id, 'system') 
WHERE user_id IS NULL AND EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'processing_queue' 
  AND column_name = 'user_id' 
  AND data_type = 'text'
);

UPDATE conversation_sessions 
SET user_id = COALESCE(line_user_id, 'system') 
WHERE user_id IS NULL AND EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'conversation_sessions' 
  AND column_name = 'user_id' 
  AND data_type = 'text'
);

-- STEP 5: Set constraints and defaults
ALTER TABLE generation_queue 
ALTER COLUMN status SET DEFAULT 'pending',
ALTER COLUMN retry_count SET DEFAULT 0,
ALTER COLUMN priority SET DEFAULT 1,
ALTER COLUMN max_retries SET DEFAULT 3;

-- Only add NOT NULL if column exists and is TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'generation_queue' 
    AND column_name = 'user_id' 
    AND data_type = 'text'
  ) THEN
    ALTER TABLE generation_queue ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- STEP 6: Create indexes
CREATE INDEX IF NOT EXISTS idx_generation_queue_user_id ON generation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_queue_line_user_id ON generation_queue(line_user_id);
CREATE INDEX IF NOT EXISTS idx_generation_queue_status ON generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id);

-- Create indexes only if columns exist as TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'processing_queue' 
    AND column_name = 'user_id' 
    AND data_type = 'text'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_processing_queue_user_id ON processing_queue(user_id);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'generated_codes' 
    AND column_name = 'user_id' 
    AND data_type = 'text'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_generated_codes_user_id ON generated_codes(user_id);
  END IF;
END $$;

-- STEP 7: Verify final structure
SELECT 
  'Final column types:' as status;

SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE column_name IN ('user_id', 'line_user_id', 'requirements')
  AND table_schema = 'public'
ORDER BY table_name, column_name;

-- STEP 8: Insert test data
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
  gen_random_uuid(),
  '{"category": "gmail", "description": "Test Gmail automation"}',
  'pending',
  1
) ON CONFLICT DO NOTHING;

-- STEP 9: Show results
SELECT 
  'Migration completed!' as status,
  COUNT(*) as total_records
FROM generation_queue;

SELECT 
  id,
  user_id,
  line_user_id,
  status,
  created_at
FROM generation_queue
ORDER BY created_at DESC
LIMIT 5;