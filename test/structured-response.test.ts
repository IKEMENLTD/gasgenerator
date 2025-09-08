import { ResponseParser } from '../lib/utils/response-parser'
import { StructuredResponse } from '../lib/utils/structured-response'

// テスト用のサンプルレスポンス
const sampleResponses = {
  // 完全な構造化レスポンス
  fullStructured: `
スプレッドシートのA列とB列を比較してC列にチェックを入れるGASコードを生成しました。

コード:
\`\`\`javascript
function checkColumns() {
  // スプレッドシートを取得
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getActiveSheet();
  
  // データの範囲を取得
  var range = sheet.getDataRange();
  var values = range.getValues();
  
  // 各行をチェック
  for (var i = 1; i < values.length; i++) {
    var valueA = values[i][0]; // A列
    var valueB = values[i][1]; // B列
    
    if (valueA === valueB) {
      sheet.getRange(i + 1, 3).setValue("TRUE");
    } else {
      sheet.getRange(i + 1, 3).setValue("FALSE");
    }
  }
}
\`\`\`

設定方法:
1. Google スプレッドシートを開く
2. メニューから「拡張機能」→「Apps Script」を選択
3. 既存のコードを削除して、上記のコードを貼り付け
4. プロジェクト名を設定して保存（Ctrl+S）
5. 実行ボタン（▶）をクリックして実行

注意点:
• 初回実行時は承認が必要です
• 1行目はヘッダー行として扱われます
• 大量のデータがある場合は処理に時間がかかることがあります
`,

  // コードのみのレスポンス
  codeOnly: `
コード:
function sendEmail() {
  var recipient = "test@example.com";
  var subject = "テストメール";
  var body = "これはテストメールです。";
  MailApp.sendEmail(recipient, subject, body);
}
`,

  // 手順のみのレスポンス
  stepsOnly: `
Gmail自動送信の設定方法:

設定方法:
1. Google Apps Scriptエディタを開く
2. 新しいプロジェクトを作成
3. コードを貼り付ける
4. 保存して実行権限を付与
5. トリガーを設定して定期実行
`,

  // 単純なテキストレスポンス
  simpleText: `
こんにちは！GASコードを生成します。
どのようなコードをお作りしましょうか？
`
}

// テスト実行関数
function runTests() {
  console.log('===== 構造化レスポンステスト開始 =====\n')
  
  const parser = new ResponseParser()
  const formatter = new StructuredResponse()
  
  // テスト1: 完全な構造化レスポンス
  console.log('【テスト1: 完全な構造化レスポンス】')
  const parsed1 = parser.parse(sampleResponses.fullStructured)
  console.log('解析結果:', JSON.stringify(parsed1, null, 2))
  const messages1 = formatter.formatResponse(sampleResponses.fullStructured)
  console.log('生成メッセージ数:', messages1.length)
  console.log('メッセージ内容:')
  messages1.forEach((msg, i) => {
    console.log(`  [${i + 1}] ${msg.type}: ${msg.text?.substring(0, 100)}...`)
  })
  console.log('\n')
  
  // テスト2: コードのみ
  console.log('【テスト2: コードのみのレスポンス】')
  const parsed2 = parser.parse(sampleResponses.codeOnly)
  console.log('解析結果:', JSON.stringify(parsed2, null, 2))
  const messages2 = formatter.formatResponse(sampleResponses.codeOnly)
  console.log('生成メッセージ数:', messages2.length)
  console.log('\n')
  
  // テスト3: 手順のみ
  console.log('【テスト3: 手順のみのレスポンス】')
  const parsed3 = parser.parse(sampleResponses.stepsOnly)
  console.log('解析結果:', JSON.stringify(parsed3, null, 2))
  const messages3 = formatter.formatResponse(sampleResponses.stepsOnly)
  console.log('生成メッセージ数:', messages3.length)
  console.log('\n')
  
  // テスト4: 単純テキスト（フォールバック）
  console.log('【テスト4: 単純テキスト（フォールバック）】')
  const parsed4 = parser.parse(sampleResponses.simpleText)
  console.log('解析結果:', JSON.stringify(parsed4, null, 2))
  const messages4 = formatter.formatResponse(sampleResponses.simpleText)
  console.log('生成メッセージ数:', messages4.length)
  console.log('\n')
  
  // テスト5: 長いコードの分割
  console.log('【テスト5: 長いコードの分割テスト】')
  const longCode = 'function test() {\n' + '  console.log("test");\n'.repeat(200) + '}'
  const longResponse = `コード生成完了\n\nコード:\n\`\`\`javascript\n${longCode}\n\`\`\``
  const messages5 = formatter.formatResponse(longResponse)
  console.log('生成メッセージ数:', messages5.length)
  console.log('コード分割数:', messages5.filter(m => m.text?.includes('[Part')).length)
  
  console.log('\n===== テスト完了 =====')
}

// エクスポート
export { runTests, sampleResponses }

// 直接実行時のテスト
if (require.main === module) {
  runTests()
}