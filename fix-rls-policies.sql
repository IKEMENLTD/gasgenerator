-- Fix RLS policies for conversation_sessions table
-- This allows anon key to read/write conversation_sessions

-- Drop existing policies
DROP POLICY IF EXISTS "Enable all access for service role" ON conversation_sessions;
DROP POLICY IF EXISTS "Sessions access control" ON conversation_sessions;
DROP POLICY IF EXISTS "Service role full access sessions" ON conversation_sessions;

-- Create new policies that allow both service role and anon key
CREATE POLICY "Allow all operations for service role" ON conversation_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- Allow anon key to perform all operations (since this is for a LINE bot)
-- The security is handled at the application level via LINE signature verification
CREATE POLICY "Allow all operations for anon" ON conversation_sessions
  FOR ALL USING (auth.role() = 'anon');

-- Alternative: If you want more restrictive anon access, use these instead:
-- CREATE POLICY "Allow anon read" ON conversation_sessions
--   FOR SELECT USING (auth.role() = 'anon');

-- CREATE POLICY "Allow anon insert" ON conversation_sessions
--   FOR INSERT WITH CHECK (auth.role() = 'anon');

-- CREATE POLICY "Allow anon update" ON conversation_sessions
--   FOR UPDATE USING (auth.role() = 'anon');

-- Verify RLS is enabled
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;

-- Show current policies for verification
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'conversation_sessions';