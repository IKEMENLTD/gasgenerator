// テストデータ投入スクリプト
// npm run db:seed で実行

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function seedData() {
  try {
    console.log('🌱 Starting database seeding...')

    // 1. テストユーザー作成
    const { data: users, error: userError } = await supabase
      .from('users')
      .insert([
        {
          line_user_id: 'U1234567890abcdef',
          display_name: 'テストユーザー1',
          skill_level: 'beginner'
        },
        {
          line_user_id: 'U2345678901bcdefg',
          display_name: 'テストユーザー2', 
          skill_level: 'intermediate'
        }
      ] as any)
      .select()

    if (userError) {
      console.error('❌ User creation error:', userError)
      return
    }

    console.log('✅ Users created:', users?.length)

    // 2. テストセッション作成
    const { data: sessions, error: sessionError } = await supabase
      .from('conversation_sessions')
      .insert([
        {
          user_id: users![0].id,
          category: 'spreadsheet',
          current_step: 2,
          collected_requirements: {
            step1: 'スプレッドシート操作',
            step2: 'データの読み取り'
          }
        }
      ] as any)
      .select()

    if (sessionError) {
      console.error('❌ Session creation error:', sessionError)
      return
    }

    console.log('✅ Sessions created:', sessions?.length)

    // 3. サンプル生成コード
    const { data: codes, error: codeError } = await supabase
      .from('generated_codes')
      .insert([
        {
          user_id: users![0].id,
          session_id: sessions![0].id,
          requirements_summary: 'スプレッドシートのA列のデータを読み取る',
          generated_code: `function readSpreadsheetData() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const dataRange = sheet.getRange('A:A');
    const values = dataRange.getValues();
    
    // 空のセルを除外
    const filteredValues = values.flat().filter(value => value !== '');
    
    console.log('読み取ったデータ:', filteredValues);
    return filteredValues;
  } catch (error) {
    console.error('エラーが発生しました:', error);
    throw error;
  }
}`,
          explanation: 'スプレッドシートのA列のデータを全て読み取り、空のセルを除外して返します。',
          usage_steps: [
            'Google スプレッドシートを開く',
            '拡張機能 > Apps Script をクリック',
            'コードをコピーして貼り付け',
            '保存して実行'
          ],
          code_category: 'spreadsheet',
          code_subcategory: 'data_read',
          claude_prompt: 'スプレッドシートのA列のデータを読み取るGASコードを作成してください',
          user_feedback: 'success'
        }
      ] as any)

    if (codeError) {
      console.error('❌ Code creation error:', codeError)
      return
    }

    console.log('✅ Sample codes created:', codes?.length)

    // 4. Claude使用ログのサンプル
    const { error: logError } = await supabase
      .from('claude_usage_logs')
      .insert([
        {
          user_id: users![0].id,
          input_tokens: 150,
          output_tokens: 300,
          estimated_cost: 0.001485, // $0.003 * 150/1000 + $0.015 * 300/1000
          success: true,
          processing_time_ms: 2500
        }
      ] as any)

    if (logError) {
      console.error('❌ Log creation error:', logError)
      return
    }

    console.log('✅ Usage logs created')

    // 5. システムメトリクスのサンプル
    const { error: metricsError } = await supabase
      .from('system_metrics')
      .insert([
        {
          metric_type: 'webhook_response_time',
          metric_value: 1250.5,
          metadata: { endpoint: '/api/webhook', method: 'POST' }
        },
        {
          metric_type: 'queue_length',
          metric_value: 3,
          metadata: { status: 'pending' }
        }
      ] as any)

    if (metricsError) {
      console.error('❌ Metrics creation error:', metricsError)
      return
    }

    console.log('✅ System metrics created')
    console.log('🎉 Database seeding completed successfully!')

  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  }
}

// 実行
if (require.main === module) {
  seedData()
}

export { seedData }