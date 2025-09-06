# 🚨 重要：Cronジョブの設定

## 現在の問題
コード生成のキュー処理が自動実行されていません！

## 解決方法

### 方法1: Render Cron Jobs（推奨）
1. Renderダッシュボードにログイン
2. 「Cron Jobs」タブを選択
3. 「New Cron Job」をクリック
4. 以下を設定：
   - Name: `queue-processor`
   - Schedule: `*/1 * * * *` (1分ごと)
   - Command: `curl https://gasgenerator.onrender.com/api/cron/process-queue`

### 方法2: 外部Cronサービス
- cron-job.org
- EasyCron
- UptimeRobot

上記サービスで以下のURLを1分ごとに呼び出し：
```
https://gasgenerator.onrender.com/api/cron/process-queue
```

### 方法3: 手動実行（テスト用）
```bash
curl https://gasgenerator.onrender.com/api/cron/process-queue
```

## なぜ必要か
- ユーザーが「はい」を押してもコードが生成されない
- キューに入るが処理されない
- Cronジョブが設定されていないと永遠に待機状態

## 確認方法
設定後、LINEボットで：
1. 「Gmail自動化」と送信
2. 要件を伝える
3. 「はい」で生成開始
4. 1-2分でコードが返ってくる