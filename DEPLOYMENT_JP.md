# TaskMate - デプロイメントガイド（日本語版）

## 📋 デプロイ前の準備チェックリスト

### 1. 必要なサービスのセットアップ
- [ ] **Supabaseプロジェクト**: 新規プロジェクト作成と認証情報の取得
- [ ] **LINE Developers**: ボット登録とチャンネルトークンの取得  
- [ ] **Anthropicアカウント**: Claude APIキーの取得
- [ ] **Vercelアカウント**: デプロイ準備完了

### 2. データベースのセットアップ
```bash
# Supabaseに接続してSQLを実行:
psql -h <あなたのホスト> -U postgres -d <あなたのDB名>
\i scripts/setup-database.sql
```

### 3. 環境変数の設定
設定ファイルをコピーして編集:
```bash
cp .env.example .env.local
```

必要な環境変数:
- `LINE_CHANNEL_ACCESS_TOKEN` - LINE Developersコンソールから取得
- `LINE_CHANNEL_SECRET` - LINE Developersコンソールから取得  
- `ANTHROPIC_API_KEY` - Anthropicコンソールから取得
- `SUPABASE_URL` - Supabaseプロジェクト設定から取得
- `SUPABASE_ANON_KEY` - SupabaseプロジェクトAPI設定から取得
- `SUPABASE_SERVICE_ROLE_KEY` - SupabaseプロジェクトAPI設定から取得
- `CRON_SECRET` - ランダムな安全な文字列を生成

## 🚀 デプロイ手順

### オプション1: 自動セットアップ
```bash
# デプロイ前チェックの実行
./scripts/deploy/pre-deploy.sh

# Vercel環境のセットアップ
./scripts/deploy/setup-env.sh

# デプロイ実行
vercel --prod
```

### オプション2: 手動セットアップ
```bash
# Vercel CLIのインストール
npm i -g vercel

# プロジェクトの初期化
vercel

# 環境変数の追加（それぞれ値を入力）
vercel env add LINE_CHANNEL_ACCESS_TOKEN
vercel env add LINE_CHANNEL_SECRET
vercel env add ANTHROPIC_API_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add CRON_SECRET

# デプロイ実行
vercel --prod
```

## 🔧 デプロイ後の設定

### 1. LINE Bot Webhook設定
1. LINE Developersコンソールにアクセス
2. あなたのボットのMessaging API設定に移動
3. Webhook URLを設定: `https://あなたのアプリ.vercel.app/api/webhook`
4. Webhookエンドポイントを検証
5. 「Webhookを利用する」をONに設定

### 2. 基本機能のテスト
```bash
# Webhookエンドポイントのテスト
curl -X POST https://あなたのアプリ.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Cronエンドポイントの確認（CRON_SECRET付き）
curl -X GET https://あなたのアプリ.vercel.app/api/cron/process-queue \
  -H "Authorization: Bearer あなたのCRON_SECRET"
```

### 3. 初期デプロイのモニタリング
- Vercelファンクションログの確認
- Supabaseデータベース接続の監視
- LINEボットレスポンスのテスト
- Claude API呼び出しの検証

## 📊 システムアーキテクチャ概要

```
┌─────────────────┐
│  LINEプラットフォーム  │
└─────────┬───────┘
          │ Webhook
          ▼
┌─────────────────┐    ┌──────────────────┐
│ Vercelファンクション │───▶│   Supabase DB    │
│   (Webhook)     │    │                  │
└─────────┬───────┘    └──────────────────┘
          │                      ▲
          ▼ キュージョブ           │
┌─────────────────┐              │
│ Vercel Cronジョブ │              │
│ (キュー処理)      │──────────────┘
└─────────┬───────┘
          │ API呼び出し
          ▼
┌─────────────────┐
│   Claude AI     │
└─────────────────┘
```

## 🔍 トラブルシューティング

### よくある問題

#### Webhook署名検証エラー
- LINE_CHANNEL_SECRETが正しく設定されているか確認
- リクエストヘッダーにx-line-signatureが含まれているか検証

#### データベース接続エラー  
- Supabase認証情報を確認
- データベーステーブルが存在するか確認
- RLSポリシーが適切に設定されているか検証

#### Claude API レート制限
- ダッシュボードで使用量を監視
- ANTHROPIC_API_KEYの有効性を確認
- 使用量追跡ログを確認

#### Cronジョブが実行されない
- CRON_SECRETが設定されているか確認
- Vercelデプロイにcron設定が含まれているか確認
- ファンクションタイムアウト制限を監視

### ヘルスチェックエンドポイント
- `GET /api/health` - システム全体のヘルスチェック
- `GET /api/cron/process-queue` - キュー処理状態  
- `GET /api/cron/cleanup` - クリーンアップジョブ状態

## 📈 監視とメンテナンス

### 重要な監視指標
- Webhookレスポンスタイム
- キュー処理の遅延  
- Claude API使用量とコスト
- データベースクエリパフォーマンス
- エラー率と失敗理由

### 定期メンテナンスタスク
- Supabaseデータベースサイズの監視
- Claude APIコストの確認
- Cronジョブ実行ログの確認
- 依存関係の定期更新

## 🔐 セキュリティの考慮事項

- CRON_SECRETを定期的にローテーション
- Webhookエンドポイントの不審なアクティビティを監視
- Supabase RLSポリシーのレビュー
- 依存関係を最新に保つ
- APIキー使用状況の監視

## 📞 サポート

デプロイ問題が発生した場合:
1. Vercelファンクションログを確認
2. Supabaseダッシュボードをレビュー  
3. LINE Developersコンソールを監視
4. Claude APIダッシュボードを確認

システムは本番デプロイ準備完了です！ 🎉