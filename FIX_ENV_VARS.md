# 🚨 環境変数の修正が必要！

## Renderで追加する環境変数：

### 1. 追加が必要（新規作成）
```
NEXT_PUBLIC_SUPABASE_URL=https://ebtcowcgkdurqdqcjrxy.supabase.co
STRIPE_SECRET_KEY=sk_test_[YOUR_STRIPE_SECRET_KEY_HERE]
```
※ STRIPE_SECRET_KEYは本番用のキーを入れてください（sk_live_で始まる）

### 2. CRONジョブ設定の修正

現在のCRON_SECRET: `render-secret-key-2024` でOKなので、cronジョブのコマンドを以下に変更：

```bash
curl -H "Authorization: Bearer render-secret-key-2024" https://gasgenerator.onrender.com/api/cron/process-queue
```

または、CRON_SECRETを統一する場合：
```
CRON_SECRET=gsg_cron_2024_xKm9Lp3QrN7vB2Hs
```
に変更して、cronジョブも合わせる。

## 現在の環境変数の状態：

| 変数名 | 状態 | 問題 |
|--------|------|------|
| ANTHROPIC_API_KEY | ✅ 設定済み | なし |
| CRON_SECRET | ⚠️ 設定済み | 値が違う（動作は可能） |
| LINE_CHANNEL_ACCESS_TOKEN | ✅ 設定済み | なし |
| LINE_CHANNEL_SECRET | ✅ 設定済み | なし |
| NEXT_PUBLIC_APP_URL | ✅ 設定済み | なし |
| NODE_ENV | ✅ 設定済み | なし |
| PORT | ✅ 設定済み | なし |
| STRIPE_WEBHOOK_SECRET | ✅ 設定済み | なし |
| SUPABASE_ANON_KEY | ✅ 設定済み | なし |
| SUPABASE_SERVICE_ROLE_KEY | ✅ 設定済み | なし |
| SUPABASE_URL | ✅ 設定済み | なし |
| **NEXT_PUBLIC_SUPABASE_URL** | ❌ **未設定** | **追加必要** |
| **STRIPE_SECRET_KEY** | ❌ **未設定** | **追加必要（決済用）** |

## テストコマンド：

### 1. API疎通確認
```bash
curl https://gasgenerator.onrender.com/api/webhook
```

### 2. Cronジョブテスト（現在の設定で）
```bash
curl -H "Authorization: Bearer render-secret-key-2024" \
  https://gasgenerator.onrender.com/api/cron/process-queue
```

### 3. データベース接続確認（Supabase）
```sql
-- Supabase SQL Editorで実行
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM generation_queue WHERE status = 'pending';
```

## これで動作するはず！

環境変数を追加したら：
1. Renderが自動的に再デプロイ
2. 2-3分待つ
3. LINEでテスト開始

問題があれば、Renderのログを確認：
- Dashboard → Logs → Live tail