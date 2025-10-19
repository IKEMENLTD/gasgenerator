# 環境変数設定ガイド

## 📋 目次
1. [必須環境変数一覧](#必須環境変数一覧)
2. [Netlify での設定方法](#netlify-での設定方法)
3. [ローカル開発環境での設定](#ローカル開発環境での設定)
4. [環境変数の確認方法](#環境変数の確認方法)
5. [トラブルシューティング](#トラブルシューティング)

---

## 必須環境変数一覧

### LINE 関連（統一チャンネル使用）

| 環境変数名 | 説明 | 取得場所 | 例 |
|-----------|------|---------|-----|
| `LINE_LOGIN_CHANNEL_ID` | LINE Login用チャンネルID | LINE Developers Console → Messaging API チャンネル → Basic settings | `2008021453` |
| `LINE_LOGIN_CHANNEL_SECRET` | LINE Login用チャンネルシークレット | LINE Developers Console → Messaging API チャンネル → LINE Login タブ | `abcdef123456...` |
| `LINE_LOGIN_CALLBACK_URL` | LINE Login後のリダイレクト先 | 自分で設定 | `https://taskmateai.net/agency/` |
| `LINE_CHANNEL_SECRET` | Messaging API用チャンネルシークレット | LINE Developers Console → Messaging API チャンネル → Basic settings | `1234567890abcdef...` |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API用アクセストークン | LINE Developers Console → Messaging API チャンネル → Messaging API settings | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `LINE_OFFICIAL_URL` | LINE公式アカウント友達追加URL | LINE Official Account Manager → アカウント設定 | `https://line.me/R/ti/p/@xxxxxxxxx` |

### Supabase 関連

| 環境変数名 | 説明 | 取得場所 | 例 |
|-----------|------|---------|-----|
| `SUPABASE_URL` | SupabaseプロジェクトURL | Supabase Dashboard → Project Settings → API | `https://xxxxxxxxxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabaseサービスロールキー | Supabase Dashboard → Project Settings → API → service_role | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### SendGrid 関連（メール送信）

| 環境変数名 | 説明 | 取得場所 | 例 |
|-----------|------|---------|-----|
| `SENDGRID_API_KEY` | SendGrid APIキー | SendGrid Dashboard → Settings → API Keys | `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `SENDGRID_FROM_EMAIL` | 送信元メールアドレス | 自分で設定（SendGridで認証済みドメイン） | `noreply@taskmateai.net` |
| `SENDGRID_FROM_NAME` | 送信元名 | 自分で設定 | `TaskMate AI` |

### Stripe 関連（課金システム）

| 環境変数名 | 説明 | 取得場所 | 例 |
|-----------|------|---------|-----|
| `STRIPE_SECRET_KEY` | Stripe APIシークレットキー | Stripe Dashboard → Developers → API keys | `sk_live_YOUR_STRIPE_SECRET_KEY_HERE` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook署名検証用シークレット | Stripe Dashboard → Developers → Webhooks | `whsec_YOUR_WEBHOOK_SECRET_HERE` |

### セキュリティ関連

| 環境変数名 | 説明 | 取得場所 | 例 |
|-----------|------|---------|-----|
| `JWT_SECRET` | JWT署名用シークレット（32文字以上ランダム） | 自分で生成 | `your-very-long-random-secret-key-here-32chars-min` |

---

## Netlify での設定方法

### 方法1: Netlify UI から設定（推奨）

1. **Netlify Dashboard にアクセス**
   - [https://app.netlify.com/](https://app.netlify.com/) にログイン
   - TaskMate AI プロジェクトを選択

2. **環境変数設定ページを開く**
   - 左メニューから「Site settings」をクリック
   - 「Environment variables」をクリック

3. **環境変数を追加**
   - 「Add a variable」ボタンをクリック
   - 「Key」に環境変数名を入力（例: `LINE_LOGIN_CHANNEL_ID`）
   - 「Values」に値を入力
   - 「Same value for all deploy contexts」を選択（本番・プレビュー・開発すべてで同じ値）
   - 「Create variable」をクリック

4. **すべての環境変数を追加**
   - 上記の手順を繰り返して、すべての必須環境変数を追加

5. **変更を反映**
   - 環境変数を追加/変更した後は**必ずサイトを再デプロイ**
   - 「Deploys」タブ → 「Trigger deploy」→「Deploy site」

### 方法2: Netlify CLI から設定

```bash
# Netlify CLI をインストール
npm install -g netlify-cli

# ログイン
netlify login

# 環境変数を設定
netlify env:set LINE_LOGIN_CHANNEL_ID "2008021453"
netlify env:set LINE_LOGIN_CHANNEL_SECRET "your-secret-here"
netlify env:set LINE_LOGIN_CALLBACK_URL "https://taskmateai.net/agency/"
netlify env:set LINE_CHANNEL_SECRET "your-secret-here"
netlify env:set LINE_CHANNEL_ACCESS_TOKEN "your-token-here"
netlify env:set LINE_OFFICIAL_URL "https://line.me/R/ti/p/@xxxxxxxxx"
netlify env:set SUPABASE_URL "https://xxxxxxxxxxxx.supabase.co"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "your-key-here"
netlify env:set SENDGRID_API_KEY "SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
netlify env:set SENDGRID_FROM_EMAIL "noreply@taskmateai.net"
netlify env:set SENDGRID_FROM_NAME "TaskMate AI"
netlify env:set JWT_SECRET "your-very-long-random-secret-key-here"

# 設定を確認
netlify env:list

# サイトを再デプロイ
netlify deploy --prod
```

---

## ローカル開発環境での設定

### .env ファイルを作成

プロジェクトルート（`netlify-tracking/`）に `.env` ファイルを作成:

```bash
cd /mnt/c/Users/ooxmi/Downloads/gas-generator/netlify-tracking
touch .env
```

### .env ファイルに環境変数を記述

```env
# LINE 関連
LINE_LOGIN_CHANNEL_ID=2008021453
LINE_LOGIN_CHANNEL_SECRET=your-secret-here
LINE_LOGIN_CALLBACK_URL=http://localhost:8888/agency/
LINE_CHANNEL_SECRET=your-secret-here
LINE_CHANNEL_ACCESS_TOKEN=your-token-here
LINE_OFFICIAL_URL=https://line.me/R/ti/p/@xxxxxxxxx

# Supabase
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key-here

# SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@taskmateai.net
SENDGRID_FROM_NAME=TaskMate AI

# Stripe
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_TEST_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# JWT
JWT_SECRET=your-very-long-random-secret-key-here-32chars-min
```

### .env をGitに含めない

`.gitignore` に `.env` が含まれていることを確認:

```bash
echo ".env" >> .gitignore
```

### ローカル開発サーバーを起動

```bash
cd netlify-tracking
npm run dev
```

Netlify Dev が `.env` ファイルを自動的に読み込みます。

---

## 環境変数の確認方法

### Netlify UI から確認

1. Netlify Dashboard → Site settings → Environment variables
2. すべての環境変数が表示される（値は隠されている）
3. 「Options」→「Reveal value」で値を確認可能

### Netlify CLI から確認

```bash
# すべての環境変数を一覧表示
netlify env:list

# 特定の環境変数の値を確認
netlify env:get LINE_LOGIN_CHANNEL_ID
```

### Functions 内で確認（デバッグ用）

一時的にログ出力して確認:

```javascript
// netlify/functions/agency-register.js など
console.log('LINE_LOGIN_CHANNEL_ID:', process.env.LINE_LOGIN_CHANNEL_ID);
console.log('LINE_LOGIN_CHANNEL_SECRET:', process.env.LINE_LOGIN_CHANNEL_SECRET ? '設定済み' : '未設定');
```

Netlify Functions ログで確認:

```bash
netlify functions:log agency-register
```

---

## トラブルシューティング

### 環境変数が反映されない

**原因:** 環境変数を変更後、サイトを再デプロイしていない

**解決方法:**
1. Netlify Dashboard → Deploys → Trigger deploy → Deploy site
2. または CLI: `netlify deploy --prod`

### 環境変数の値が間違っている

**確認方法:**
```bash
netlify env:get LINE_LOGIN_CHANNEL_ID
```

**修正方法:**
```bash
# 既存の値を削除
netlify env:unset LINE_LOGIN_CHANNEL_ID

# 正しい値を再設定
netlify env:set LINE_LOGIN_CHANNEL_ID "2008021453"
```

### ローカル開発で環境変数が読み込まれない

**原因1:** `.env` ファイルが `netlify-tracking/` ディレクトリにない

**解決方法:**
```bash
cd /mnt/c/Users/ooxmi/Downloads/gas-generator/netlify-tracking
ls -la .env  # ファイルが存在するか確認
```

**原因2:** Netlify Dev が起動していない

**解決方法:**
```bash
# 通常の npm コマンドではなく、Netlify Dev を使用
npm run dev  # これは netlify dev を実行する
```

### LINE Login で "Invalid client_id" エラー

**原因:** `LINE_LOGIN_CHANNEL_ID` が間違っている

**確認方法:**
1. LINE Developers Console で正しいチャンネルIDを確認
2. Netlify 環境変数と一致しているか確認

**解決方法:**
```bash
netlify env:set LINE_LOGIN_CHANNEL_ID "正しいチャンネルID"
netlify deploy --prod
```

### LINE からメッセージが送信されない

**原因1:** `LINE_CHANNEL_ACCESS_TOKEN` が間違っているまたは期限切れ

**解決方法:**
1. LINE Developers Console で新しいトークンを発行
2. Netlify 環境変数を更新
3. サイトを再デプロイ

**原因2:** `LINE_OFFICIAL_URL` が設定されていない

**解決方法:**
```bash
netlify env:set LINE_OFFICIAL_URL "https://line.me/R/ti/p/@your-bot-id"
netlify deploy --prod
```

### Supabase 接続エラー

**原因:** `SUPABASE_URL` または `SUPABASE_SERVICE_ROLE_KEY` が間違っている

**確認方法:**
1. Supabase Dashboard → Project Settings → API
2. URL と service_role key をコピー

**解決方法:**
```bash
netlify env:set SUPABASE_URL "https://xxxxxxxxxxxx.supabase.co"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "正しいキー"
netlify deploy --prod
```

---

## セキュリティのベストプラクティス

### 🔒 環境変数の安全な管理

1. **絶対にGitにコミットしない**
   - `.env` ファイルは `.gitignore` に追加
   - `SUPABASE_SERVICE_ROLE_KEY` や `STRIPE_SECRET_KEY` は特に重要

2. **本番環境と開発環境で異なる値を使用**
   - 本番: `sk_live_...`, `LINE_CHANNEL_ACCESS_TOKEN`（本番用）
   - 開発: `sk_test_...`, テスト用トークン

3. **定期的にトークンを更新**
   - LINE Channel Access Token は有効期限なしだが、セキュリティのため定期的に再発行
   - Stripe Webhook Secret も定期的に再生成

4. **必要最小限の権限を付与**
   - Supabase: `service_role` キーは必要な場合のみ使用
   - SendGrid: 必要なスコープ（メール送信のみ）に制限

---

## 環境変数チェックリスト

統一チャンネル使用時の必須環境変数:

- [ ] `LINE_LOGIN_CHANNEL_ID`（Messaging APIチャンネルID）
- [ ] `LINE_LOGIN_CHANNEL_SECRET`（LINE Login用Secret）
- [ ] `LINE_LOGIN_CALLBACK_URL`
- [ ] `LINE_CHANNEL_SECRET`（Messaging API用Secret）
- [ ] `LINE_CHANNEL_ACCESS_TOKEN`
- [ ] `LINE_OFFICIAL_URL`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `SENDGRID_API_KEY`
- [ ] `SENDGRID_FROM_EMAIL`
- [ ] `SENDGRID_FROM_NAME`
- [ ] `JWT_SECRET`

オプション（Stripe課金を使用する場合）:

- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`

すべてチェックが完了したら、環境変数の設定は完了です！

---

## 参考リンク

- [Netlify Environment Variables ドキュメント](https://docs.netlify.com/environment-variables/overview/)
- [Netlify CLI ドキュメント](https://docs.netlify.com/cli/get-started/)
- [LINE Developers Console](https://developers.line.biz/console/)
- [Supabase Dashboard](https://app.supabase.com/)
- [SendGrid Dashboard](https://app.sendgrid.com/)
- [Stripe Dashboard](https://dashboard.stripe.com/)
