# 🚀 TaskMateセットアップガイド

## 現在の作業ディレクトリ
```
/mnt/c/Users/ooxmi/Downloads/gas-generator
```

## 📋 準備するもの

### 1. LINE Developersで取得する情報
- **Channel access token**: LINE Developersコンソール > Messaging API > 「Channel access token (long-lived)」で発行
- **Channel secret**: LINE Developersコンソール > Basic settings > 「Channel secret」

### 2. Supabaseで取得する情報  
- **URL**: プロジェクト設定 > API > 「URL」欄
- **anon key**: プロジェクト設定 > API > 「anon public」欄
- **service_role key**: プロジェクト設定 > API > 「service_role secret」欄

### 3. Anthropic Claudeで取得する情報
- **API Key**: [https://console.anthropic.com/](https://console.anthropic.com/) > API Keys > Create Key

## 🔧 環境変数の設定

`.env.local`ファイルを開いて、以下の値を設定してください：

```bash
# ファイルを編集
nano /mnt/c/Users/ooxmi/Downloads/gas-generator/.env.local
```

または、以下のコマンドで1つずつ設定：

```bash
# LINE設定
echo "LINE_CHANNEL_ACCESS_TOKEN=あなたのトークン" >> .env.local
echo "LINE_CHANNEL_SECRET=あなたのシークレット" >> .env.local

# Claude設定  
echo "ANTHROPIC_API_KEY=あなたのAPIキー" >> .env.local
echo "CLAUDE_API_KEY=あなたのAPIキー" >> .env.local

# Supabase設定
echo "SUPABASE_URL=https://xxxxx.supabase.co" >> .env.local
echo "SUPABASE_ANON_KEY=あなたのanonキー" >> .env.local
echo "SUPABASE_SERVICE_ROLE_KEY=あなたのserviceキー" >> .env.local

# セキュリティ設定（自動生成）
echo "CRON_SECRET=$(openssl rand -base64 32)" >> .env.local
echo "WEBHOOK_SECRET=$(openssl rand -base64 32)" >> .env.local
```

## 📊 Supabaseデータベースのセットアップ

1. Supabaseダッシュボードで「SQL Editor」を開く
2. 以下のファイルの内容をコピー＆ペースト：
   `/mnt/c/Users/ooxmi/Downloads/gas-generator/scripts/setup-database.sql`
3. 「Run」をクリックして実行

## 🚀 デプロイ準備

### 依存関係のインストール
```bash
cd /mnt/c/Users/ooxmi/Downloads/gas-generator
npm install
```

### Vercel CLIのインストール（まだの場合）
```bash
npm install -g vercel
```

### Vercelへのデプロイ
```bash
vercel
```

初回は以下の質問に答えます：
- Set up and deploy? → Y
- Which scope? → あなたのアカウント選択
- Link to existing project? → N
- Project name? → gas-generator（または好きな名前）
- Directory? → ./
- Override settings? → N

## ⚙️ Vercelで環境変数を設定

Vercelダッシュボードまたはコマンドで設定：

```bash
# コマンドで設定する場合
vercel env add LINE_CHANNEL_ACCESS_TOKEN production
vercel env add LINE_CHANNEL_SECRET production
vercel env add ANTHROPIC_API_KEY production
vercel env add CLAUDE_API_KEY production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add CRON_SECRET production
```

## 🎯 デプロイ実行

```bash
vercel --prod
```

## ✅ デプロイ後の設定

### LINE Webhook URLの設定
1. LINE Developersコンソールを開く
2. Messaging API設定へ
3. Webhook URLに以下を設定：
   `https://あなたのアプリ名.vercel.app/api/webhook`
4. 「Verify」で接続テスト
5. 「Use webhook」をONに

## 🧪 動作確認

LINEボットに友達追加して、メッセージを送信してテスト！

---

困ったときは、以下をチェック：
- Vercelのファンクションログ
- Supabaseのダッシュボード
- LINE Developersのログ