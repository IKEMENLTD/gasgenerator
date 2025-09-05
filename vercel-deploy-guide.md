# 🚀 Vercelデプロイガイド

## ✅ 現在の状況
- LINE設定: ✅ 完了
- Claude AI設定: ✅ 完了
- Supabase設定: ✅ 完了
- データベース: ✅ 作成済み
- npmパッケージ: ✅ インストール済み
- Vercel CLI: ✅ インストール済み

## 📝 必要な環境変数（Vercel用）

以下の値をVercelに設定する必要があります：

```
LINE_CHANNEL_ACCESS_TOKEN = （設定済み）
LINE_CHANNEL_SECRET = （設定済み）
ANTHROPIC_API_KEY = （設定済み）
CLAUDE_API_KEY = （設定済み）
SUPABASE_URL = https://ebtcowcgkdurqdqcjrxy.supabase.co
SUPABASE_ANON_KEY = （設定済み）
SUPABASE_SERVICE_ROLE_KEY = （設定済み）
WEBHOOK_SECRET = fioTkN5G5fpAZ+t2qtHAakGxVDBLmIEWSbJlKMW0je8=
CRON_SECRET = VLReR3wh5mRPF6W2wcs31vrFtcnCxPSOS+D32qiYTDo=
```

## 🚀 デプロイコマンド

### 1. Vercelにログイン
```bash
vercel login
```

### 2. プロジェクトをデプロイ
```bash
vercel
```

初回は以下の質問に答えます：
- **Set up and deploy?** → `Y`
- **Which scope?** → あなたのアカウントを選択
- **Link to existing project?** → `N`（新規プロジェクト）
- **Project name?** → `gas-generator`（または好きな名前）
- **In which directory is your code located?** → `./`（Enter押すだけ）
- **Want to override the settings?** → `N`

### 3. 環境変数を設定

デプロイ後、環境変数を設定します：

```bash
# 1つずつ設定する場合
vercel env add LINE_CHANNEL_ACCESS_TOKEN production
vercel env add LINE_CHANNEL_SECRET production
vercel env add ANTHROPIC_API_KEY production
vercel env add CLAUDE_API_KEY production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add WEBHOOK_SECRET production
vercel env add CRON_SECRET production
```

### 4. 本番環境にデプロイ
```bash
vercel --prod
```

## 🔗 デプロイ後の設定

### LINE Webhook URLの設定

1. デプロイ完了後、URLが表示されます（例: `https://gas-generator.vercel.app`）

2. LINE Developersコンソールで設定：
   - Messaging API設定 → Webhook settings
   - Webhook URL: `https://あなたのアプリ.vercel.app/api/webhook`
   - Use webhook: ON
   - Verify: クリックして接続テスト

## 📋 動作確認

1. LINEボットを友達追加
2. メッセージを送信してテスト
3. Vercelダッシュボードでログを確認

## 🛠️ トラブルシューティング

### エラーが出た場合
- Vercelダッシュボードでファンクションログを確認
- 環境変数が全て設定されているか確認
- Supabaseの接続を確認

---

準備ができたら `vercel` コマンドを実行してください！