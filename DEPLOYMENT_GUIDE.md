# TaskMate LINE招待トラッキングシステム - デプロイガイド

## 📋 前提条件

- Node.js 18以上
- Supabaseアカウント
- Netlifyアカウント
- LINE Developersアカウント
- Redis（オプション、本番環境推奨）

## 🚀 セットアップ手順

### 1. リポジトリのクローン

```bash
git clone [your-repository-url]
cd gas-generator
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. Supabaseセットアップ

#### 3.1 プロジェクト作成
1. [Supabase](https://supabase.com)でプロジェクト作成
2. プロジェクトURL、Anon Key、Service Keyを取得

#### 3.2 データベーススキーマ適用

```bash
# Supabase CLIインストール（未インストールの場合）
npm install -g supabase

# ログイン
supabase login

# プロジェクトをリンク
supabase link --project-ref [your-project-ref]

# マイグレーション実行
supabase db push
```

または、Supabaseダッシュボードから直接SQLを実行：
1. SQL Editorを開く
2. `supabase/migrations/001_create_tracking_tables.sql`の内容を実行
3. `supabase/migrations/002_create_transaction_function.sql`の内容を実行

### 4. LINE Bot設定

#### 4.1 LINE Developers Console
1. [LINE Developers](https://developers.line.biz)にログイン
2. プロバイダーとチャネル（Messaging API）を作成
3. 以下を取得：
   - Channel Secret
   - Channel Access Token
   - LINE Official Account Manager → 友だち追加URL

#### 4.2 Webhook URL設定
```
https://[your-domain]/api/webhook/line
```

### 5. 環境変数設定

#### 5.1 ローカル開発用（.env.local）

```bash
cp .env.example .env.local
```

以下を設定：
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_KEY=[your-service-key]

# LINE
LINE_CHANNEL_SECRET=[your-channel-secret]
LINE_CHANNEL_ACCESS_TOKEN=[your-channel-access-token]
LINE_FRIEND_URL=https://lin.ee/[your-line-id]
NEXT_PUBLIC_LINE_FRIEND_URL=https://lin.ee/[your-line-id]

# Admin
ADMIN_API_KEY=[generate-random-key]
ADMIN_API_SECRET=[generate-random-secret]

# App
NEXT_PUBLIC_APP_URL=https://taskmateai.net

# Redis（本番環境用、オプション）
REDIS_URL=redis://[redis-host]:[port]
```

### 6. Netlifyデプロイ

#### 6.1 Netlify CLIを使用

```bash
# Netlify CLIインストール
npm install -g netlify-cli

# ログイン
netlify login

# サイト作成
netlify init

# デプロイ
netlify deploy --prod
```

#### 6.2 GitHubと連携（推奨）

1. GitHubにリポジトリをプッシュ
2. Netlifyダッシュボードで「New site from Git」
3. リポジトリを選択
4. ビルド設定：
   - Build command: `npm run build`
   - Publish directory: `.next`
5. 環境変数をNetlifyダッシュボードで設定

### 7. デプロイ後の確認

#### 7.1 ヘルスチェック
```bash
curl https://[your-domain]/api/health
```

成功時のレスポンス：
```json
{
  "status": "healthy",
  "checks": {
    "database": true,
    "environment": true,
    "redis": true,
    "lineApi": true
  }
}
```

#### 7.2 管理画面アクセス
```
https://[your-domain]/admin/tracking
```

#### 7.3 トラッキングリンクテスト
1. 管理画面でトラッキングリンク作成
2. URLをブラウザで開く
3. 認証トークンが表示されることを確認
4. LINEで友だち追加してトークン送信

## 📊 監視設定

### Netlify Functions監視
Netlifyダッシュボード → Functions → Logsで確認

### エラー通知（オプション）
1. Sentryアカウント作成
2. 環境変数追加：
   ```env
   NEXT_PUBLIC_SENTRY_DSN=[your-sentry-dsn]
   ```

## 🔧 トラブルシューティング

### データベース接続エラー
- Supabaseプロジェクトのステータス確認
- Service Keyの権限確認
- RLS（Row Level Security）設定確認

### LINE Webhook受信できない
- Webhook URLの設定確認
- Use webhookが有効か確認
- Channel SecretとAccess Tokenの確認

### トラッキングリンクが機能しない
- Netlify functionsのログ確認
- 環境変数の設定確認
- データベースのtracking_linksテーブル確認

### セッションが保存されない
- Supabaseのtracking_sessionsテーブル確認
- タイムゾーン設定確認
- トランザクション関数の権限確認

## 🔐 セキュリティチェックリスト

- [ ] 環境変数が正しく設定されている
- [ ] ADMIN_API_KEYとADMIN_API_SECRETが強固なランダム値
- [ ] Supabase RLSが有効
- [ ] LINE Channel Secretが正しく設定
- [ ] HTTPSが有効（Netlifyは自動）
- [ ] 不要なconsole.logが削除されている

## 📈 パフォーマンス最適化

### Redis有効化（推奨）
1. Redis Cloudなどでインスタンス作成
2. REDIS_URL環境変数設定
3. ヘルスチェックでRedis接続確認

### CDN設定
Netlifyが自動的にCDNを提供

## 🔄 アップデート手順

```bash
# 最新のコードを取得
git pull origin main

# 依存関係を更新
npm install

# ビルドテスト
npm run build

# デプロイ
git push origin main  # GitHub連携の場合、自動デプロイ
# または
netlify deploy --prod  # 手動デプロイ
```

## 📞 サポート

問題が発生した場合：
1. `/api/health`エンドポイントで状態確認
2. Netlify Functionsログ確認
3. Supabaseログ確認
4. 環境変数の再確認