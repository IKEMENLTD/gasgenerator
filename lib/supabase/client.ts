import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { logger } from '@/lib/utils/logger'

// ダミークライアント（環境変数がない場合のフォールバック）
class DummySupabaseClient {
  from() {
    const errorResult = { data: null, error: new Error('Supabase not configured') }
    const chainableMethods = {
      select: () => chainableMethods,
      insert: () => chainableMethods,
      update: () => chainableMethods,
      delete: () => chainableMethods,
      upsert: () => chainableMethods,
      eq: () => chainableMethods,
      neq: () => chainableMethods,
      gt: () => chainableMethods,
      gte: () => chainableMethods,
      lt: () => chainableMethods,
      lte: () => chainableMethods,
      like: () => chainableMethods,
      ilike: () => chainableMethods,
      is: () => chainableMethods,
      in: () => chainableMethods,
      contains: () => chainableMethods,
      containedBy: () => chainableMethods,
      range: () => chainableMethods,
      overlaps: () => chainableMethods,
      match: () => chainableMethods,
      not: () => chainableMethods,
      or: () => chainableMethods,
      filter: () => chainableMethods,
      order: () => chainableMethods,
      limit: () => chainableMethods,
      offset: () => chainableMethods,
      single: () => Promise.resolve(errorResult),
      maybeSingle: () => Promise.resolve(errorResult),
      then: (resolve: any) => resolve(errorResult)
    }
    return chainableMethods
  }
  
  rpc() {
    return Promise.resolve({ data: null, error: new Error('Supabase not configured') })
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
export const supabase: SupabaseClient<Database> = 
  (supabaseUrl && supabaseAnonKey) 
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : new DummySupabaseClient() as any

// 管理者権限クライアント（RLS無効）
export const supabaseAdmin: SupabaseClient<Database> = 
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