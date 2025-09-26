#!/usr/bin/env node

const crypto = require('crypto')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

console.log(colors.cyan + '========================================' + colors.reset)
console.log(colors.cyan + ' TaskMate Premium Activation Code Generator' + colors.reset)
console.log(colors.cyan + '========================================' + colors.reset)

console.log('\n' + colors.yellow + 'コードタイプを選択してください:' + colors.reset)
console.log('1. マスターコード (10年間有効)')
console.log('2. 年間コード (1年間有効)')
console.log('3. 月間コード (30日間有効)')
console.log('4. テストコード (7日間有効)')
console.log('5. カスタム期間')

rl.question('\n選択 (1-5): ', (choice) => {
  let duration = 365
  let prefix = 'PREMIUM-ACTIVATE'

  switch (choice) {
    case '1':
      duration = 3650
      prefix = 'MASTER'
      generateMasterCode()
      rl.close()
      return

    case '2':
      duration = 365
      prefix = 'PREMIUM-ACTIVATE'
      break

    case '3':
      duration = 30
      prefix = 'MONTHLY'
      break

    case '4':
      duration = 7
      prefix = 'TEST'
      break

    case '5':
      rl.question('有効期間（日数）: ', (days) => {
        duration = parseInt(days) || 30
        generateCode(prefix, duration)
        rl.close()
      })
      return

    default:
      console.log(colors.red + '無効な選択です' + colors.reset)
      rl.close()
      return
  }

  generateCode(prefix, duration)
  rl.close()
})

function generateMasterCode() {
  // Generate super secret master code
  const randomPart = crypto.randomBytes(32).toString('hex').toUpperCase()
  const masterCode = `TASKMATE_PREMIUM_${new Date().getFullYear()}_MASTER_ACTIVATION_${randomPart.substring(0, 32)}`

  console.log('\n' + colors.green + '========================================' + colors.reset)
  console.log(colors.green + ' マスターコード生成完了' + colors.reset)
  console.log(colors.green + '========================================' + colors.reset)

  console.log('\n' + colors.magenta + '⚠️  極秘コード - 厳重に管理してください' + colors.reset)
  console.log(colors.yellow + masterCode + colors.reset)

  console.log('\n' + colors.cyan + '詳細:' + colors.reset)
  console.log('- タイプ: マスターコード')
  console.log('- 有効期間: 10年')
  console.log('- 機能: 全プレミアム機能 + 特別機能')

  console.log('\n' + colors.red + '警告:' + colors.reset)
  console.log('このコードは即座にプレミアムプランを有効化します。')
  console.log('絶対に外部に漏らさないでください。')

  // Also generate a shorter emergency code
  const emergencyCode = `EMERGENCY_OVERRIDE_TASKMATE_PREMIUM_ACCESS_${crypto.randomBytes(24).toString('hex').toUpperCase()}`

  console.log('\n' + colors.yellow + '緊急用コード:' + colors.reset)
  console.log(colors.yellow + emergencyCode + colors.reset)
}

function generateCode(prefix, duration) {
  const year = new Date().getFullYear()
  const randomPart = crypto.randomBytes(16).toString('hex').toUpperCase()

  let code
  if (prefix === 'PREMIUM-ACTIVATE') {
    // Standard format
    code = `${prefix}-${year}-${randomPart}${randomPart}`
  } else if (prefix === 'TEST') {
    // Shorter test code
    code = `TM-TEST-${randomPart}`
  } else {
    // Custom format
    code = `TM-${prefix}-${randomPart}${crypto.randomBytes(8).toString('hex').toUpperCase()}`
  }

  console.log('\n' + colors.green + '========================================' + colors.reset)
  console.log(colors.green + ' アクティベーションコード生成完了' + colors.reset)
  console.log(colors.green + '========================================' + colors.reset)

  console.log('\n' + colors.yellow + 'アクティベーションコード:' + colors.reset)
  console.log(colors.cyan + code + colors.reset)

  console.log('\n' + colors.blue + '詳細:' + colors.reset)
  console.log(`- 有効期間: ${duration}日`)
  console.log(`- 生成日時: ${new Date().toLocaleString('ja-JP')}`)
  console.log(`- コード長: ${code.length}文字`)

  console.log('\n' + colors.green + '使用方法:' + colors.reset)
  console.log('1. LINEでTaskMateボットを友だち追加')
  console.log('2. トークでこのコードを送信')
  console.log('3. プレミアムプランが自動的に有効化されます')

  // Generate hash for database storage
  const codeHash = crypto.createHash('sha256').update(code).digest('hex')

  console.log('\n' + colors.blue + 'データベース用ハッシュ:' + colors.reset)
  console.log(colors.gray + codeHash + colors.reset)

  // Generate SQL for manual insertion
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + duration)

  console.log('\n' + colors.blue + 'SQL挿入コマンド:' + colors.reset)
  console.log(`INSERT INTO activation_codes (code, code_hash, type, expires_at)`)
  console.log(`VALUES ('${code}', '${codeHash}', 'premium', '${expiresAt.toISOString()}');`)
}

// Handle Ctrl+C gracefully
rl.on('SIGINT', () => {
  console.log('\n' + colors.red + 'キャンセルされました' + colors.reset)
  process.exit(0)
})