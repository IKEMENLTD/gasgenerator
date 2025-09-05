# 🎯 Vercel無料プラン用セットアップ

## Cronジョブ制限への対応

Vercelの無料プランでは、Cronジョブは1日1回までです。
そのため、以下の調整を行いました：

### 変更内容：
- ❌ 削除: 2分毎のキュー処理 (`*/2 * * * *`)
- ✅ 保持: 1日1回のクリーンアップ (`0 0 * * *`)

### キュー処理の代替方法：

#### 方法1: 手動実行（開発中）
```bash
# ローカルから手動でキュー処理を実行
curl https://gas-generator.vercel.app/api/cron/process-queue \
  -H "Authorization: Bearer VLReR3wh5mRPF6W2wcs31vrFtcnCxPSOS+D32qiYTDo="
```

#### 方法2: 外部Cronサービス（本番用）
- [cron-job.org](https://cron-job.org) （無料）
- [EasyCron](https://www.easycron.com) （無料枠あり）

これらのサービスから2分毎に以下のURLを叩く：
```
https://gas-generator.vercel.app/api/cron/process-queue
```
ヘッダー: `Authorization: Bearer YOUR_CRON_SECRET`

#### 方法3: Webhook内で直接処理（シンプル）
キューを使わず、Webhook内で直接Claude APIを呼び出す。
（10秒制限内で処理が完了する場合）

## 再デプロイ手順

vercel.jsonを修正したので、再度デプロイします：

```cmd
npx vercel --prod
```

これで本番環境にデプロイされます！