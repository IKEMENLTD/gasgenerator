import { Scenario } from './types'

export const inventoryAlert: Scenario = {
  id: 'inventory-alert',
  title: '在庫アラート通知',
  description: '在庫数が閾値以下になったらSlackで自動通知',
  userRequest: 'スプレッドシートの在庫数をチェックして、閾値以下になったら担当者にSlackで通知したいです。',
  aiResponse: `承知しました。以下の内容で自動化プログラムを作成します:

✓ スプレッドシートから在庫データを取得
✓ 閾値以下の商品を検出
✓ Slackに通知を送信
✓ 1時間ごとに自動チェック

プログラムを生成しますね...`,
  code: `function checkInventoryAndAlert() {
  // スプレッドシートとSlackの設定
  const sheetId = 'YOUR_SHEET_ID';
  const slackWebhookUrl = 'YOUR_SLACK_WEBHOOK_URL';
  const threshold = 10; // 在庫閾値

  const sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();
  const data = sheet.getDataRange().getValues();

  // ヘッダー行を除く
  const items = data.slice(1);
  const lowStockItems = [];

  // 在庫チェック
  items.forEach((row, index) => {
    const itemName = row[0];
    const currentStock = Number(row[1]);
    const minStock = Number(row[2]) || threshold;

    if (currentStock <= minStock) {
      lowStockItems.push({
        name: itemName,
        current: currentStock,
        min: minStock,
        rowNumber: index + 2
      });
    }
  });

  // アラートが必要な場合、Slackに通知
  if (lowStockItems.length > 0) {
    const message = createSlackMessage(lowStockItems);
    sendToSlack(slackWebhookUrl, message);

    // スプレッドシートにアラート記録
    logAlert(sheet, lowStockItems);
  }

  Logger.log(\`チェック完了: \${lowStockItems.length}件の在庫不足を検出\`);
}

function createSlackMessage(items) {
  let message = '⚠️ *在庫アラート*\\n\\n';
  message += \`\${items.length}件の商品が在庫不足です:\\n\\n\`;

  items.forEach(item => {
    message += \`• *\${item.name}*: 現在\${item.current}個 (最小\${item.min}個)\\n\`;
  });

  return {
    text: message,
    username: 'TaskMate在庫管理Bot'
  };
}

function sendToSlack(webhookUrl, message) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(message)
  };

  UrlFetchApp.fetch(webhookUrl, options);
}

function logAlert(sheet, items) {
  const logSheet = sheet.getParent().getSheetByName('アラート履歴')
    || sheet.getParent().insertSheet('アラート履歴');

  items.forEach(item => {
    logSheet.appendRow([
      new Date(),
      item.name,
      item.current,
      item.min,
      '通知送信済み'
    ]);
  });
}

// トリガー設定用の関数
function createHourlyTrigger() {
  ScriptApp.newTrigger('checkInventoryAndAlert')
    .timeBased()
    .everyHours(1)
    .create();
}`,
  setupInstructions: `1. Googleスプレッドシートを開く
2. 「拡張機能」→「Apps Script」を選択
3. 上記コードをペースト
4. YOUR_SHEET_IDとYOUR_SLACK_WEBHOOK_URLを実際の値に置き換え
5. createHourlyTrigger()を一度実行してトリガーを設定
6. 完了！1時間ごとに在庫をチェックします`,
  timeSaved: 30,
  costSaved: 60000,
  errorReduction: 98
}
