import { Scenario } from './types'

export const salesAggregation: Scenario = {
  id: 'sales-aggregation',
  title: '売上データの自動集計',
  description: 'Googleフォームからの売上データをスプレッドシートに自動集計',
  userRequest: '毎日の売上データをGoogleフォームから取得して、スプレッドシートに自動で集計したいです。売上合計と平均も計算してほしいです。',
  aiResponse: `承知しました。以下の内容で自動化プログラムを作成します:

✓ Googleフォームから回答を取得
✓ スプレッドシートへデータ転記
✓ 売上合計・平均を自動計算
✓ 毎日朝9時に自動実行

プログラムを生成しますね...`,
  code: `/**
 * 売上データ自動集計スクリプト
 * Googleフォームから今日の回答を取得し、スプレッドシートに集計
 */

function aggregateSalesData() {
  try {
    // ========== 設定 ==========
    // 以下のIDを実際の値に置き換えてください
    const FORM_ID = 'YOUR_FORM_ID_HERE';  // 例: '1abc...xyz'
    const SHEET_ID = 'YOUR_SHEET_ID_HERE'; // 例: '1def...xyz'

    // ========== 初期化 ==========
    Logger.log('=== 売上データ集計開始 ===');

    const form = FormApp.openById(FORM_ID);
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName('集計結果');

    // シートがなければ作成
    if (!sheet) {
      sheet = ss.insertSheet('集計結果');
      sheet.appendRow(['日時', '売上金額', '備考', '状態']);
      sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#4CAF50').setFontColor('white');
    }

    // ========== 今日の日付範囲を設定 ==========
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    Logger.log(\`対象期間: \${Utilities.formatDate(today, 'JST', 'yyyy/MM/dd')} - \${Utilities.formatDate(tomorrow, 'JST', 'yyyy/MM/dd')}\`);

    // ========== フォーム回答を取得 ==========
    const responses = form.getResponses();
    let totalSales = 0;
    let processedCount = 0;
    const newRows = [];

    // 既存データの日時を取得（重複チェック用）
    const existingData = sheet.getDataRange().getValues();
    const existingTimestamps = existingData.slice(1).map(row =>
      row[0] ? new Date(row[0]).getTime() : null
    ).filter(t => t !== null);

    // ========== 今日の回答を処理 ==========
    responses.forEach((response, index) => {
      const timestamp = response.getTimestamp();
      const timestampValue = timestamp.getTime();

      // 今日の回答かつ未処理のもののみ
      if (timestamp >= today && timestamp < tomorrow && !existingTimestamps.includes(timestampValue)) {
        const itemResponses = response.getItemResponses();

        // 質問が2つ以上ある場合のみ処理
        if (itemResponses.length > 0) {
          // 最初の質問を売上金額として取得
          const salesText = itemResponses[0].getResponse();
          const sales = Number(String(salesText).replace(/[^0-9.-]/g, ''));

          // 数値変換できない場合はスキップ
          if (isNaN(sales)) {
            Logger.log(\`警告: 回答\${index + 1}の売上金額が数値ではありません: "\${salesText}"\`);
            return;
          }

          // 2つ目の質問を備考として取得（なければ空文字）
          const note = itemResponses.length > 1 ? itemResponses[1].getResponse() : '';

          newRows.push([
            timestamp,
            sales,
            note,
            '処理済み'
          ]);

          totalSales += sales;
          processedCount++;
        }
      }
    });

    // ========== データを一括挿入 ==========
    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 4).setValues(newRows);
      Logger.log(\`✓ \${newRows.length}件の新しい回答を追加しました\`);
    } else {
      Logger.log('ℹ 新しい回答はありませんでした');
    }

    // ========== 集計結果を計算 ==========
    const average = processedCount > 0 ? totalSales / processedCount : 0;

    // ========== サマリー行を追加 ==========
    if (processedCount > 0) {
      const summaryRow = sheet.getLastRow() + 1;
      sheet.appendRow([
        \`【\${Utilities.formatDate(today, 'JST', 'yyyy/MM/dd')} 集計】\`,
        \`¥\${totalSales.toLocaleString()}\`,
        \`件数: \${processedCount}件 / 平均: ¥\${Math.round(average).toLocaleString()}\`,
        '集計完了'
      ]);

      // サマリー行を目立たせる
      sheet.getRange(summaryRow, 1, 1, 4)
        .setFontWeight('bold')
        .setBackground('#E3F2FD')
        .setFontColor('#1976D2');
    }

    // ========== 完了ログ ==========
    Logger.log(\`\n=== 集計完了 ===\`);
    Logger.log(\`処理件数: \${processedCount}件\`);
    Logger.log(\`売上合計: ¥\${totalSales.toLocaleString()}\`);
    Logger.log(\`売上平均: ¥\${Math.round(average).toLocaleString()}\`);

  } catch (error) {
    Logger.log(\`❌ エラーが発生しました: \${error.message}\`);
    Logger.log(\`スタックトレース: \${error.stack}\`);

    // エラー通知をメール送信（オプション）
    // MailApp.sendEmail({
    //   to: 'your-email@example.com',
    //   subject: '【TaskMate】売上集計でエラー発生',
    //   body: \`エラー内容: \${error.message}\\n\\nスタックトレース:\\n\${error.stack}\`
    // });

    throw error; // エラーを再スロー
  }
}

/**
 * 毎日自動実行するトリガーを設定
 * 初回のみ手動で実行してください
 */
function createDailyTrigger() {
  // 既存のトリガーを削除（重複防止）
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'aggregateSalesData') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('既存のトリガーを削除しました');
    }
  });

  // 新しいトリガーを作成
  ScriptApp.newTrigger('aggregateSalesData')
    .timeBased()
    .everyDays(1)
    .atHour(9)  // 毎朝9時に実行
    .inTimezone('Asia/Tokyo')
    .create();

  Logger.log('✓ 毎日9時の自動実行トリガーを設定しました');
}

/**
 * 手動実行用：IDの取得方法を表示
 */
function showHowToGetIds() {
  Logger.log(\`
=== IDの取得方法 ===

【Googleフォーム】
1. フォームを開く
2. URLから取得: https://docs.google.com/forms/d/【ここがFORM_ID】/edit

【Googleスプレッドシート】
1. スプレッドシートを開く
2. URLから取得: https://docs.google.com/spreadsheets/d/【ここがSHEET_ID】/edit

取得したIDをコード内の以下の箇所に貼り付けてください:
- FORM_ID = 'YOUR_FORM_ID_HERE'
- SHEET_ID = 'YOUR_SHEET_ID_HERE'
  \`);
}`,
  setupInstructions: `1. Googleスプレッドシートを開く
2. 「拡張機能」→「Apps Script」を選択
3. 上記コードを全て選択してペースト
4. IDの取得:
   - showHowToGetIds() を実行してID取得方法を確認
   - フォームURL: https://docs.google.com/forms/d/【ここがID】/edit
   - シートURL: https://docs.google.com/spreadsheets/d/【ここがID】/edit
5. FORM_IDとSHEET_IDを実際の値に置き換え
6. aggregateSalesData() を一度テスト実行
7. エラーがなければ createDailyTrigger() を実行
8. 完了！毎日朝9時に自動集計されます

※初回は手動で aggregateSalesData() を実行して動作確認してください`,
  timeSaved: 40,
  costSaved: 80000,
  errorReduction: 95
}
