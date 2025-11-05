import { Scenario } from './types'

export const weeklyReport: Scenario = {
  id: 'weekly-report',
  title: '週次レポート自動送信',
  description: '毎週金曜日に週次レポートをメールで自動送信',
  userRequest: '毎週金曜日の17時に、その週のデータをまとめたレポートを関係者にメールで送信したいです。',
  aiResponse: `承知しました。以下の内容で自動化プログラムを作成します:

✓ スプレッドシートから週次データを集計
✓ HTMLフォーマットのレポート作成
✓ 関係者リストへ一括メール送信
✓ 毎週金曜17時に自動実行

プログラムを生成しますね...`,
  code: `function sendWeeklyReport() {
  // スプレッドシートと設定
  const sheetId = 'YOUR_SHEET_ID';
  const recipients = 'recipient1@example.com, recipient2@example.com';

  const sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();

  // 今週のデータを取得
  const weekData = getThisWeekData(sheet);

  // レポートを生成
  const reportHtml = createReportHtml(weekData);

  // メール送信
  const subject = \`週次レポート - \${Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd')}\`;

  GmailApp.sendEmail(recipients, subject, '', {
    htmlBody: reportHtml,
    name: 'TaskMate自動レポート'
  });

  Logger.log('週次レポートを送信しました');
}

function getThisWeekData(sheet) {
  const data = sheet.getDataRange().getValues();
  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ヘッダー行を除く
  const records = data.slice(1).filter(row => {
    const date = new Date(row[0]);
    return date >= oneWeekAgo && date <= today;
  });

  // 集計
  const totalSales = records.reduce((sum, row) => sum + Number(row[1]), 0);
  const avgSales = records.length > 0 ? totalSales / records.length : 0;
  const maxSales = Math.max(...records.map(row => Number(row[1])));

  return {
    period: \`\${Utilities.formatDate(oneWeekAgo, 'JST', 'MM/dd')} - \${Utilities.formatDate(today, 'JST', 'MM/dd')}\`,
    totalSales,
    avgSales,
    maxSales,
    recordCount: records.length,
    records: records.slice(0, 10) // 最新10件
  };
}

function createReportHtml(data) {
  return \`
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #10b981; color: white; padding: 20px; border-radius: 8px; }
    .stats { display: flex; gap: 20px; margin: 20px 0; }
    .stat { background: #f3f4f6; padding: 15px; border-radius: 8px; flex: 1; }
    .stat-value { font-size: 24px; font-weight: bold; color: #10b981; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>週次レポート</h1>
    <p>期間: \${data.period}</p>
  </div>

  <div class="stats">
    <div class="stat">
      <div>売上合計</div>
      <div class="stat-value">¥\${data.totalSales.toLocaleString()}</div>
    </div>
    <div class="stat">
      <div>平均売上</div>
      <div class="stat-value">¥\${Math.round(data.avgSales).toLocaleString()}</div>
    </div>
    <div class="stat">
      <div>最高売上</div>
      <div class="stat-value">¥\${data.maxSales.toLocaleString()}</div>
    </div>
  </div>

  <h2>最新のデータ（直近10件）</h2>
  <table>
    <thead>
      <tr>
        <th>日付</th>
        <th>売上</th>
        <th>備考</th>
      </tr>
    </thead>
    <tbody>
      \${data.records.map(row => \`
        <tr>
          <td>\${Utilities.formatDate(new Date(row[0]), 'JST', 'MM/dd HH:mm')}</td>
          <td>¥\${Number(row[1]).toLocaleString()}</td>
          <td>\${row[2] || '-'}</td>
        </tr>
      \`).join('')}
    </tbody>
  </table>

  <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
    このレポートはTaskMateによって自動生成されました。
  </p>
</body>
</html>
  \`;
}

// トリガー設定用の関数
function createWeeklyTrigger() {
  ScriptApp.newTrigger('sendWeeklyReport')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(17)
    .create();
}`,
  setupInstructions: `1. Googleスプレッドシートを開く
2. 「拡張機能」→「Apps Script」を選択
3. 上記コードをペースト
4. YOUR_SHEET_IDと受信者メールアドレスを実際の値に置き換え
5. createWeeklyTrigger()を一度実行してトリガーを設定
6. 完了！毎週金曜17時にレポートが送信されます`,
  timeSaved: 20,
  costSaved: 40000,
  errorReduction: 100,
  details: {
    timeSavedDetail: '週次レポート作成 × 5時間 × 4週',
    costSavedDetail: '時給2,000円 × 20時間分の人件費',
    errorReductionDetail: '自動生成により報告漏れ・遅延ゼロ'
  }
}
