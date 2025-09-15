import { createClient as createSupabaseClientLib, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { logger } from '@/lib/utils/logger'

// 環境変数のチェック（エラーは投げない）
const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  logger.warn('Supabase environment variables are missing. Database operations will be disabled.')
}

// 通常のクライアント（RLS有効）- 必ず実際のクライアントを返す
export const supabase: SupabaseClient<Database> = createSupabaseClientLib<Database>(
  supabaseUrl || 'https://dummy.supabase.co',
  supabaseAnonKey || 'dummy-anon-key'
)

// 管理者権限クライアント（RLS無効）
export const supabaseAdmin: SupabaseClient<Database> = createSupabaseClientLib<Database>(
  supabaseUrl || 'https://dummy.supabase.co',
  supabaseServiceRoleKey || 'dummy-service-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Supabaseクライアント作成関数をエクスポート
export function createSupabaseClient(): SupabaseClient<Database> {
  return supabase
}

// 接続テスト関数
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('users')
      .select('count')
      .limit(1)

    return !error
  } catch {
    return false
  }
}