import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { logger } from '@/lib/utils/logger'

// ダミークライアント（環境変数がない場合のフォールバック）
class DummySupabaseClient {
  from() {
    return {
      select: () => ({ data: null, error: new Error('Supabase not configured') }),
      insert: () => ({ data: null, error: new Error('Supabase not configured') }),
      update: () => ({ data: null, error: new Error('Supabase not configured') }),
      delete: () => ({ data: null, error: new Error('Supabase not configured') }),
      upsert: () => ({ data: null, error: new Error('Supabase not configured') })
    }
  }
}

// 環境変数のチェック（エラーは投げない）
const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  logger.warn('Supabase environment variables are missing. Database operations will be disabled.')
}

// 通常のクライアント（RLS有効）
export const supabase: SupabaseClient<Database> | DummySupabaseClient = 
  (supabaseUrl && supabaseAnonKey) 
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : new DummySupabaseClient() as any

// 管理者権限クライアント（RLS無効）
export const supabaseAdmin: SupabaseClient<Database> | DummySupabaseClient = 
  (supabaseUrl && supabaseServiceRoleKey)
    ? createClient<Database>(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )
    : new DummySupabaseClient() as any

// 接続テスト関数
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      
    return !error
  } catch {
    return false
  }
}