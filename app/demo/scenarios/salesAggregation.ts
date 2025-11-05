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
  code: `function aggregateSalesData() {
  // Googleフォームとスプレッドシートの設定
  const formId = 'YOUR_FORM_ID';
  const sheetId = 'YOUR_SHEET_ID';

  const form = FormApp.openById(formId);
  const sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();

  // フォームの回答を取得
  const responses = form.getResponses();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalSales = 0;
  let count = 0;

  // 今日の回答を処理
  responses.forEach(response => {
    const timestamp = response.getTimestamp();
    if (timestamp >= today) {
      const itemResponses = response.getItemResponses();
      const sales = Number(itemResponses[0].getResponse());

      // スプレッドシートに追加
      sheet.appendRow([
        timestamp,
        sales,
        itemResponses[1]?.getResponse() || ''
      ]);

      totalSales += sales;
      count++;
    }
  });

  // 合計と平均を計算
  const average = count > 0 ? totalSales / count : 0;

  // サマリー行を追加
  sheet.appendRow([
    '集計結果',
    \`合計: ¥\${totalSales.toLocaleString()}\`,
    \`平均: ¥\${Math.round(average).toLocaleString()}\`
  ]);

  Logger.log(\`処理完了: \${count}件の売上データを集計しました\`);
}

// トリガー設定用の関数
function createDailyTrigger() {
  ScriptApp.newTrigger('aggregateSalesData')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
}`,
  setupInstructions: `1. Googleスプレッドシートを開く
2. 「拡張機能」→「Apps Script」を選択
3. 上記コードをペースト
4. YOUR_FORM_IDとYOUR_SHEET_IDを実際のIDに置き換え
5. createDailyTrigger()を一度実行してトリガーを設定
6. 完了！毎日自動で集計されます`,
  timeSaved: 40,
  costSaved: 80000,
  errorReduction: 95
}
