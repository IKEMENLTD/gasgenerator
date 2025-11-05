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
  code: `/**
 * 在庫アラート自動通知システム
 * スプレッドシートの在庫をチェックし、閾値以下の商品をSlackに通知
 */

function checkInventoryAndAlert() {
  try {
    // ========== 設定 ==========
    const SHEET_ID = 'YOUR_SHEET_ID_HERE';
    const SLACK_WEBHOOK_URL = 'YOUR_SLACK_WEBHOOK_URL_HERE';
    const DEFAULT_THRESHOLD = 10; // デフォルト在庫閾値

    Logger.log('=== 在庫チェック開始 ===');

    // ========== スプレッドシート取得 ==========
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const inventorySheet = ss.getSheetByName('在庫管理') || ss.getActiveSheet();
    const data = inventorySheet.getDataRange().getValues();

    // ヘッダー行を確認
    if (data.length < 2) {
      Logger.log('ℹ データが存在しません');
      return;
    }

    const header = data[0];
    Logger.log(\`カラム: \${header.join(', ')}\`);

    // ========== 在庫チェック ==========
    const lowStockItems = [];
    const currentTime = new Date();

    // ヘッダー行を除いて処理
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // 商品名が空の場合はスキップ
      if (!row[0]) continue;

      const itemName = row[0];
      const currentStockText = row[1];
      const minStockText = row[2];

      // 数値変換
      const currentStock = Number(String(currentStockText).replace(/[^0-9.-]/g, ''));
      const minStock = minStockText ? Number(String(minStockText).replace(/[^0-9.-]/g, '')) : DEFAULT_THRESHOLD;

      // 在庫数が閾値以下の場合
      if (!isNaN(currentStock) && currentStock <= minStock) {
        lowStockItems.push({
          rowNumber: i + 1,
          name: itemName,
          currentStock: currentStock,
          minStock: minStock,
          shortage: minStock - currentStock
        });
      }
    }

    Logger.log(\`チェック完了: \${data.length - 1}商品中、\${lowStockItems.length}件が在庫不足\`);

    // ========== Slack通知 ==========
    if (lowStockItems.length > 0) {
      const message = createSlackMessage(lowStockItems);
      sendToSlack(SLACK_WEBHOOK_URL, message);
      Logger.log(\`✓ Slackに通知を送信しました（\${lowStockItems.length}件）\`);

      // アラート履歴を記録
      logAlert(ss, lowStockItems, currentTime);
    } else {
      Logger.log('✓ 在庫不足の商品はありません');
    }

  } catch (error) {
    Logger.log(\`❌ エラー: \${error.message}\`);
    Logger.log(\`スタックトレース: \${error.stack}\`);

    // エラーもSlackに通知（オプション）
    try {
      const errorMessage = {
        text: \`:warning: *在庫チェックでエラー発生*\\n\\n\` +
              \`エラー内容: \${error.message}\\n\` +
              \`時刻: \${Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd HH:mm:ss')}\`,
        username: 'TaskMate在庫管理Bot（エラー通知）'
      };
      // sendToSlack(SLACK_WEBHOOK_URL, errorMessage);
    } catch (e) {
      Logger.log('Slackへのエラー通知も失敗しました');
    }

    throw error;
  }
}

/**
 * Slack用メッセージを作成
 */
function createSlackMessage(items) {
  // 緊急度順にソート（不足数が多い順）
  items.sort((a, b) => b.shortage - a.shortage);

  let text = ':warning: *在庫アラート*\\n\\n';
  text += \`\${items.length}件の商品が在庫不足です:\\n\\n\`;

  items.forEach((item, index) => {
    const urgency = item.shortage >= 5 ? '🔴' : '🟡';
    text += \`\${urgency} *\${item.name}*\\n\`;
    text += \`   現在: \${item.currentStock}個 / 最小: \${item.minStock}個 \`;
    text += \`(不足: \${item.shortage}個)\\n\`;
    text += \`   行番号: \${item.rowNumber}\\n\\n\`;
  });

  text += \`\\n📊 チェック時刻: \${Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd HH:mm:ss')}\`;

  return {
    text: text,
    username: 'TaskMate在庫管理Bot',
    icon_emoji: ':package:'
  };
}

/**
 * Slackに通知を送信
 */
function sendToSlack(webhookUrl, message) {
  if (!webhookUrl || webhookUrl === 'YOUR_SLACK_WEBHOOK_URL_HERE') {
    Logger.log('⚠ Slack Webhook URLが設定されていません');
    return;
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(message),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(webhookUrl, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      Logger.log('✓ Slack通知成功');
    } else {
      Logger.log(\`⚠ Slack通知失敗: HTTPステータス \${responseCode}\`);
      Logger.log(\`レスポンス: \${response.getContentText()}\`);
    }
  } catch (error) {
    Logger.log(\`❌ Slack通知エラー: \${error.message}\`);
    throw error;
  }
}

/**
 * アラート履歴をスプレッドシートに記録
 */
function logAlert(ss, items, timestamp) {
  let logSheet = ss.getSheetByName('アラート履歴');

  // 履歴シートがなければ作成
  if (!logSheet) {
    logSheet = ss.insertSheet('アラート履歴');
    logSheet.appendRow(['日時', '商品名', '現在在庫', '最小在庫', '不足数', '行番号']);
    logSheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#FF9800').setFontColor('white');
  }

  // アラートをログに記録
  items.forEach(item => {
    logSheet.appendRow([
      timestamp,
      item.name,
      item.currentStock,
      item.minStock,
      item.shortage,
      item.rowNumber
    ]);
  });

  Logger.log(\`✓ アラート履歴に\${items.length}件を記録しました\`);
}

/**
 * 1時間ごとの自動実行トリガーを設定
 */
function createHourlyTrigger() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkInventoryAndAlert') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('既存のトリガーを削除しました');
    }
  });

  // 新しいトリガーを作成（1時間ごと）
  ScriptApp.newTrigger('checkInventoryAndAlert')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('✓ 1時間ごとの自動チェックトリガーを設定しました');
}

/**
 * Slack Webhook URLの取得方法を表示
 */
function showHowToGetSlackWebhook() {
  Logger.log(\`
=== Slack Webhook URLの取得方法 ===

1. Slackワークスペースにログイン
2. https://api.slack.com/apps にアクセス
3. 「Create New App」→「From scratch」を選択
4. App Nameを入力（例: TaskMate在庫アラート）
5. Workspaceを選択
6. 左メニューから「Incoming Webhooks」を選択
7. 「Activate Incoming Webhooks」をONにする
8. 「Add New Webhook to Workspace」をクリック
9. 通知を送信したいチャンネルを選択
10. 表示されたWebhook URLをコピー

取得したURLをコード内の以下に貼り付けてください:
SLACK_WEBHOOK_URL = 'YOUR_SLACK_WEBHOOK_URL_HERE'

【スプレッドシートのフォーマット】
以下の形式でシートを作成してください:

| 商品名    | 現在在庫 | 最小在庫 |
|----------|---------|---------|
| 商品A     | 5       | 10      |
| 商品B     | 15      | 10      |
  \`);
}`,
  setupInstructions: `1. Googleスプレッドシートを準備
   - シート名「在庫管理」を作成
   - 1行目: 商品名 | 現在在庫 | 最小在庫
   - データを入力

2. Slack Webhook URLを取得
   - showHowToGetSlackWebhook() を実行して手順を確認
   - https://api.slack.com/apps で設定
   - Incoming Webhooksを有効化

3. Apps Scriptを設定
   - スプレッドシートで「拡張機能」→「Apps Script」
   - コードを全て貼り付け
   - SHEET_IDとSLACK_WEBHOOK_URLを実際の値に置き換え

4. テスト実行
   - checkInventoryAndAlert() を手動実行
   - Slackに通知が届くか確認

5. 自動実行設定
   - createHourlyTrigger() を実行
   - 完了！1時間ごとに在庫チェックが実行されます`,
  timeSaved: 30,
  costSaved: 60000,
  errorReduction: 98,
  details: {
    timeSavedDetail: '1日3回の在庫確認 × 5分 × 20営業日',
    costSavedDetail: '時給2,000円 × 30時間分の人件費',
    errorReductionDetail: '在庫切れ見逃しによる機会損失を防止'
  }
}
