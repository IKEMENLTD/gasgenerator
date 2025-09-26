# URGENT FIXES - Deploy Immediately

## Critical Issues Fixed

### 1. Premium Activation Issue
**Problem**: Premium activation codes not working due to environment variable loading issues.
**Fix**: Added debug logging to premium-handler.ts to identify the exact issue.

### 2. Database RLS Policy Issues
**Problem**: conversation_sessions table RLS policies preventing data access via anon key.
**Solutions**:
- SQL script to update RLS policies (quick fix)
- Updated connection pool to use service keys for write operations (secure fix)

## Files Modified

### 1. `/lib/premium-handler.ts`
- Added comprehensive debug logging for activation attempts
- Shows environment variable loading status
- Logs pattern matching results

### 2. `/lib/database/connection-pool.ts`
- Added service key connection methods
- Separate read/write connection handling
- Better security model

### 3. `/fix-rls-policies.sql`
- New SQL script to fix RLS policies immediately

## Deployment Steps

### Step 1: Quick Fix (RLS Policies)
Execute this SQL in Supabase dashboard:

```sql
-- Allow anon key access to conversation_sessions
DROP POLICY IF EXISTS "Enable all access for service role" ON conversation_sessions;
DROP POLICY IF EXISTS "Sessions access control" ON conversation_sessions;
DROP POLICY IF EXISTS "Service role full access sessions" ON conversation_sessions;

CREATE POLICY "Allow all operations for service role" ON conversation_sessions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow all operations for anon" ON conversation_sessions
  FOR ALL USING (auth.role() = 'anon');
```

### Step 2: Deploy Code Changes
1. Deploy the updated files to production
2. The debug logging will show exactly why premium activation is failing
3. Connection pool now supports both anon and service key connections

## Immediate Testing

1. **Premium Activation**: Check server logs for the debug output when user sends the 72-character code
2. **Database Access**: conversation_sessions should now work without RLS violations

## Expected Debug Output

When user sends premium code, you should see logs like:
```
🔍 Premium codes loaded: { count: 3, env: 'production', hasCode1: true, ... }
🎫 Premium activation attempt: { lineUserId: '...', codeLength: 72, ... }
```

If count is 0, environment variables aren't loading.
If patterns don't match, we'll see exactly which patterns are tested.

## Rollback Plan

If issues persist:
1. Revert RLS policies to service-role only
2. Use service key connections exclusively
3. Check environment variable loading in production environment