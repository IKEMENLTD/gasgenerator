# TaskMate - GAS Code Generator

LINEボットとClaude AIを使用したGoogle Apps Script自動生成システム

## 🚀 機能概要

- **LINE Bot Integration**: 自然言語でのやり取り
- **Claude AI**: 高品質なコード生成
- **Async Processing**: Vercelの制限を回避する非同期処理
- **Usage Tracking**: コスト管理と制限機能
- **Conversation Flow**: 3ステップの対話型インターフェース

## 📋 前提条件

- Node.js 18以上
- Supabase アカウント
- LINE Developers アカウント
- Anthropic Claude API キー
- Vercel アカウント（デプロイ用）

## 🛠️ セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` を `.env.local` にコピーして設定

```bash
cp .env.example .env.local
```

必要な環境変数:
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

### 3. Supabaseデータベース設定

```bash
# setup-database.sqlを実行
psql -h <host> -U <user> -d <database> -f scripts/setup-database.sql
```

### 4. 開発環境での実行

```bash
npm run dev
```

## 🚀 デプロイ

### Vercelへのデプロイ

1. Vercel CLIのインストール
```bash
npm i -g vercel
```

2. プロジェクトの初期化
```bash
vercel
```

3. 環境変数の設定
```bash
vercel env add
```

4. デプロイ
```bash
vercel --prod
```

### LINE Bot Webhook設定

デプロイ後、以下のURLをLINE Developersコンソールで設定:
```
https://your-app.vercel.app/api/webhook
```

## 📊 システム構成

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│    LINE     │───▶│   Webhook    │───▶│   Queue     │
│    Bot      │    │   Handler    │    │  Manager    │
└─────────────┘    └──────────────┘    └─────────────┘
                           │                     │
                           ▼                     ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ Conversation│    │   Database   │    │   Claude    │
│    Flow     │◀───│  (Supabase)  │───▶│     AI      │
└─────────────┘    └──────────────┘    └─────────────┘
```

## 🔧 主要コンポーネント

### Webhook Handler
- `app/api/webhook/route.ts`
- LINE イベント処理
- 署名検証
- レート制限

### Queue System
- `lib/queue/manager.ts`
- `lib/queue/processor.ts`
- 非同期処理管理
- バックグラウンドジョブ

### Cron Jobs
- `app/api/cron/process-queue/route.ts`
- `app/api/cron/cleanup/route.ts`
- 定期実行処理

### Claude Integration
- `lib/claude/client.ts`
- `lib/claude/usage-tracker.ts`
- API呼び出し管理
- 使用量監視

## 📈 モニタリング

### メトリクス
- リクエスト数追跡
- 処理時間測定
- エラー率監視
- コスト管理

### ログ
- 構造化ログ
- エラー追跡
- パフォーマンス分析

## 🔐 セキュリティ

- LINE署名検証
- Cron認証
- Rate Limiting
- Input Validation

## 📝 ライセンス

Private Project - All Rights Reserved