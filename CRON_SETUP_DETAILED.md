# 🔴 緊急：Cronジョブ設定手順（必須）

## なぜ必要？
現在、コード生成が**100%動作しません**。理由：

```
現在の流れ：
1. ユーザー「はい」クリック
2. データベースのキューに保存される ✅
3. キューを処理する...？ ← 誰も処理しない！❌
4. ユーザーは永遠に待つ...
```

## Renderでの設定方法

### 方法A: Render Cron Jobs（有料プランのみ）

もしRenderが有料プランの場合：
1. https://dashboard.render.com にログイン
2. 上部メニューの「Cron Jobs」をクリック
3. 「New Cron Job」ボタンをクリック
4. 以下を入力：
   - **Name**: queue-processor
   - **Command**: `curl https://gasgenerator.onrender.com/api/cron/process-queue`
   - **Schedule**: `*/1 * * * *` （1分ごと）
   - **Runtime**: Shell

### 方法B: 無料の外部Cronサービス（推奨）

#### 1. cron-job.org を使用（完全無料）

1. https://cron-job.org/en/ にアクセス
2. 「Sign up free」でアカウント作成
3. ログイン後、「CREATE CRONJOB」をクリック
4. 以下を設定：

```
Title: GAS Generator Queue Processor
URL: https://gasgenerator.onrender.com/api/cron/process-queue
Schedule: 
  - Execution schedule: Every 1 minute
  または
  - Minutes: */1 を選択
  - Hours: * (すべて)
  - Days: * (すべて)
  - Months: * (すべて)
  - Weekdays: * (すべて)

Method: GET
```

5. 「CREATE」をクリック

#### 2. UptimeRobot を使用（無料プランあり）

1. https://uptimerobot.com/ にアクセス
2. アカウント作成
3. 「Add New Monitor」をクリック
4. 以下を設定：

```
Monitor Type: HTTP(s)
Friendly Name: GAS Queue Processor
URL: https://gasgenerator.onrender.com/api/cron/process-queue
Monitoring Interval: 1 minute
```

### 方法C: GitHub Actions（完全無料）

1. GitHubリポジトリで `.github/workflows/cron.yml` を作成：

```yaml
name: Process Queue
on:
  schedule:
    - cron: '*/1 * * * *'  # 1分ごと
  workflow_dispatch:  # 手動実行も可能

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Call Queue Processor
        run: |
          curl https://gasgenerator.onrender.com/api/cron/process-queue
```

2. GitHubにプッシュ
3. Actions タブで有効化

## 🧪 設定後のテスト方法

1. LINEボットを開く
2. 「Gmail自動化」と送信
3. 「メールをスプシに記録」と送信
4. 「はい」をクリック
5. **1-2分待つ**
6. コードが返ってくれば成功！

## ⚠️ 注意事項

- **設定しないと永遠にコードが生成されません**
- 1分ごとの実行が推奨（頻度が低いと待ち時間が長い）
- 無料サービスでも問題なく動作します

## 📊 動作確認

設定後、以下のURLにアクセスして確認：
```
https://gasgenerator.onrender.com/api/cron/process-queue
```

以下のようなレスポンスが返れば正常：
```json
{
  "processed": 0,
  "errors": 0,
  "remaining": 0,
  "message": "Queue processing completed"
}
```

## 🆘 トラブルシューティング

### コードが返ってこない場合

1. Cronが動いているか確認
   - 設定したサービスのダッシュボードで実行ログを確認
   
2. 手動でテスト実行
   ```bash
   curl https://gasgenerator.onrender.com/api/cron/process-queue
   ```

3. Renderのログを確認
   - エラーメッセージがないかチェック

### よくあるエラー

- **401 Unauthorized**: CRON_SECRETの設定が必要かも
- **500 Error**: データベース接続エラーの可能性
- **タイムアウト**: 処理が重すぎる（通常は問題なし）

## 💡 なぜRenderに組み込まれていないのか

- Renderの無料プランではCronジョブがサポートされていない
- 有料プランでも別途設定が必要
- Next.jsのEdge Runtimeでは定期実行ができない

## 📞 サポート

問題が解決しない場合は、以下の情報と共に報告してください：
- 使用したCronサービス
- エラーメッセージ
- Renderのログ