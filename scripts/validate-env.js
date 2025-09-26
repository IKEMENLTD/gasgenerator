#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const https = require('https')

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
}

console.log(colors.blue + '========================================' + colors.reset)
console.log(colors.blue + ' TaskMate 環境変数検証ツール' + colors.reset)
console.log(colors.blue + '========================================' + colors.reset)

// Load environment variables
const envPath = path.join(process.cwd(), '.env.local')
if (!fs.existsSync(envPath)) {
  console.error(colors.red + '✗ .env.local ファイルが見つかりません' + colors.reset)
  process.exit(1)
}

require('dotenv').config({ path: envPath })

const validationResults = []

// Required environment variables
const requiredVars = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    validate: (value) => {
      return value && value.startsWith('https://') && value.includes('supabase.co')
    },
    message: 'Supabase URLの形式が正しくありません'
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    validate: (value) => {
      return value && value.length > 30
    },
    message: 'Supabase Anon Keyが設定されていません'
  },
  {
    name: 'SUPABASE_URL',
    validate: (value) => {
      return value && value.startsWith('https://') && value.includes('supabase.co')
    },
    message: 'Supabase URLの形式が正しくありません'
  },
  {
    name: 'SUPABASE_SERVICE_KEY',
    validate: (value) => {
      return value && value.length > 30 && value !== 'your-service-role-key'
    },
    message: 'Supabase Service Keyが設定されていません'
  },
  {
    name: 'LINE_CHANNEL_SECRET',
    validate: (value) => {
      return value && value.length === 32 && value !== 'your-line-channel-secret'
    },
    message: 'LINE Channel Secretは32文字である必要があります'
  },
  {
    name: 'LINE_CHANNEL_ACCESS_TOKEN',
    validate: (value) => {
      return value && value.length > 100 && value !== 'your-line-channel-access-token'
    },
    message: 'LINE Channel Access Tokenが設定されていません'
  },
  {
    name: 'LINE_FRIEND_URL',
    validate: (value) => {
      return value && value.startsWith('https://lin.ee/') && !value.includes('YOUR_LINE_ID')
    },
    message: 'LINE友だち追加URLが正しく設定されていません'
  },
  {
    name: 'NEXT_PUBLIC_LINE_FRIEND_URL',
    validate: (value) => {
      return value && value.startsWith('https://lin.ee/') && !value.includes('YOUR_LINE_ID')
    },
    message: 'LINE友だち追加URLが正しく設定されていません'
  },
  {
    name: 'ADMIN_API_KEY',
    validate: (value) => {
      return value && value.length >= 16 && value !== 'your-admin-api-key'
    },
    message: 'Admin API Keyは16文字以上である必要があります'
  },
  {
    name: 'ADMIN_API_SECRET',
    validate: (value) => {
      return value && value.length >= 32 && value !== 'your-admin-api-secret'
    },
    message: 'Admin API Secretは32文字以上である必要があります'
  }
]

// Optional environment variables
const optionalVars = [
  {
    name: 'REDIS_URL',
    validate: (value) => {
      return !value || value.startsWith('redis://') || value.startsWith('rediss://')
    },
    message: 'Redis URLの形式が正しくありません'
  },
  {
    name: 'NEXT_PUBLIC_APP_URL',
    validate: (value) => {
      return !value || value.startsWith('https://')
    },
    message: 'App URLはHTTPSである必要があります'
  }
]

console.log('\n' + colors.yellow + '必須環境変数をチェック中...' + colors.reset)

// Validate required variables
for (const varConfig of requiredVars) {
  const value = process.env[varConfig.name]
  const isValid = varConfig.validate(value)

  if (isValid) {
    console.log(colors.green + `✓ ${varConfig.name}` + colors.reset)
    validationResults.push({ name: varConfig.name, status: 'valid' })
  } else {
    console.log(colors.red + `✗ ${varConfig.name}: ${varConfig.message}` + colors.reset)
    validationResults.push({ name: varConfig.name, status: 'invalid', message: varConfig.message })
  }
}

console.log('\n' + colors.yellow + 'オプション環境変数をチェック中...' + colors.reset)

// Validate optional variables
for (const varConfig of optionalVars) {
  const value = process.env[varConfig.name]

  if (!value) {
    console.log(colors.blue + `○ ${varConfig.name} (未設定)` + colors.reset)
    continue
  }

  const isValid = varConfig.validate(value)

  if (isValid) {
    console.log(colors.green + `✓ ${varConfig.name}` + colors.reset)
  } else {
    console.log(colors.red + `✗ ${varConfig.name}: ${varConfig.message}` + colors.reset)
  }
}

// Connection tests
console.log('\n' + colors.yellow + '接続テストを実行中...' + colors.reset)

// Test Supabase connection
async function testSupabase() {
  return new Promise((resolve) => {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)

    https.get({
      hostname: url.hostname,
      path: '/rest/v1/',
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }
    }, (res) => {
      if (res.statusCode === 200 || res.statusCode === 401) {
        console.log(colors.green + '✓ Supabase接続: 成功' + colors.reset)
        resolve(true)
      } else {
        console.log(colors.red + `✗ Supabase接続: 失敗 (Status: ${res.statusCode})` + colors.reset)
        resolve(false)
      }
    }).on('error', (err) => {
      console.log(colors.red + `✗ Supabase接続: エラー (${err.message})` + colors.reset)
      resolve(false)
    })
  })
}

// Test LINE API connection
async function testLineAPI() {
  return new Promise((resolve) => {
    https.get({
      hostname: 'api.line.me',
      path: '/v2/bot/info',
      headers: {
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      }
    }, (res) => {
      if (res.statusCode === 200) {
        console.log(colors.green + '✓ LINE API接続: 成功' + colors.reset)
        resolve(true)
      } else if (res.statusCode === 401) {
        console.log(colors.red + '✗ LINE API接続: 認証エラー (トークンを確認してください)' + colors.reset)
        resolve(false)
      } else {
        console.log(colors.red + `✗ LINE API接続: 失敗 (Status: ${res.statusCode})` + colors.reset)
        resolve(false)
      }
    }).on('error', (err) => {
      console.log(colors.red + `✗ LINE API接続: エラー (${err.message})` + colors.reset)
      resolve(false)
    })
  })
}

// Run tests
Promise.all([
  testSupabase(),
  testLineAPI()
]).then((results) => {
  // Summary
  console.log('\n' + colors.blue + '========================================' + colors.reset)
  console.log(colors.blue + ' 検証結果サマリー' + colors.reset)
  console.log(colors.blue + '========================================' + colors.reset)

  const invalidVars = validationResults.filter(r => r.status === 'invalid')
  const validVars = validationResults.filter(r => r.status === 'valid')

  console.log(colors.green + `✓ 有効: ${validVars.length}/${requiredVars.length}` + colors.reset)

  if (invalidVars.length > 0) {
    console.log(colors.red + `✗ 無効: ${invalidVars.length}` + colors.reset)
    console.log('\n' + colors.yellow + '修正が必要な環境変数:' + colors.reset)
    invalidVars.forEach(v => {
      console.log(`  - ${v.name}: ${v.message}`)
    })
  }

  const allTestsPassed = results.every(r => r === true)
  const allVarsValid = invalidVars.length === 0

  if (allTestsPassed && allVarsValid) {
    console.log('\n' + colors.green + '✅ すべての検証に成功しました！デプロイ準備完了です。' + colors.reset)
    process.exit(0)
  } else {
    console.log('\n' + colors.red + '❌ 問題が見つかりました。上記のエラーを修正してください。' + colors.reset)
    process.exit(1)
  }
})