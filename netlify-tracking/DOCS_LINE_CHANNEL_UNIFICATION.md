# LINE チャンネル統一ガイド

## 📋 目次
1. [なぜチャンネル統一が必要なのか](#なぜチャンネル統一が必要なのか)
2. [現在の問題](#現在の問題)
3. [解決方法](#解決方法)
4. [統一手順](#統一手順)
5. [環境変数の更新](#環境変数の更新)
6. [テスト手順](#テスト手順)

---

## なぜチャンネル統一が必要なのか

LINE では、**チャンネルごとに異なる userId が発行**されます。

### 問題のシナリオ

1. **LINE Login チャンネル (2008314222)** で認証
   - ユーザーの `userId` = `U1234567890abcdef`（例）

2. **Messaging API チャンネル (2008021453)** からメッセージ送信を試みる
   - 同じユーザーでも `userId` が異なるため、**メッセージが届かない**

### 正しい構成

**Messaging API チャンネル1つ**で以下の機能を統一:
- LINE Login機能（OAuth2認証）
- Messaging API機能（メッセージ送信、Webhook受信）

これにより、Login で取得した `userId` でメッセージ送信が可能になります。

---

## 現在の問題

### 使用中のチャンネル

| 用途 | チャンネルID | 問題 |
|------|-------------|------|
| LINE Login | 2008314222 | Login専用チャンネル（Messaging機能なし） |
| Messaging API | 2008021453 | メッセージ送信専用（Login で取得した userId に送信不可） |

### 発生する不具合

- ✅ LINE Login 自体は成功する
- ❌ 登録完了メッセージが届かない
- ❌ webhookで友達追加を検知できない（異なるチャンネルのため）

---

## 解決方法

**選択肢A: Messaging API チャンネルに LINE Login 機能を追加（推奨）**

Messaging API チャンネル（2008021453）に LINE Login 機能を有効化し、すべての機能を1つのチャンネルに統一します。

**メリット:**
- 既存の友達を維持できる
- Webhook設定を変更不要
- Channel Access Token を変更不要
- シンプルで管理しやすい

---

## 統一手順

### STEP 1: LINE Developers Console にアクセス

1. [LINE Developers Console](https://developers.line.biz/console/) にログイン
2. Provider を選択
3. **Messaging API チャンネル (2008021453)** を選択

### STEP 2: LINE Login を有効化

1. チャンネル設定ページで「LINE Login」タブをクリック
2. 「LINE Login を有効にする」をクリック

### STEP 3: Callback URL を設定

1. 「LINE Login設定」→「Callback URL」に以下を追加:

```
https://taskmateai.net/agency/
```

必要に応じて開発環境用も追加:
```
http://localhost:3000/agency/
http://localhost:8888/agency/
```

### STEP 4: スコープを設定

以下のスコープを有効化:
- ✅ `profile` (ユーザーID、表示名、プロフィール画像)
- ✅ `openid` (OpenID Connect用)

### STEP 5: Channel ID と Channel Secret を取得

#### LINE Login の情報を取得

「LINE Login」タブから:
- **Channel ID**: `2008021453`（Messaging API と同じ）
- **Channel Secret**: `[LINE Login用のChannel Secret]`

> **注意:** Messaging API の Channel Secret とは異なります！

#### Messaging API の情報を確認

「Messaging API」タブから:
- **Channel Secret**: `[Messaging API用のChannel Secret]`
- **Channel Access Token**: 既存のトークンを確認

### STEP 6: 情報を整理

統一後に使用する値:

| 環境変数名 | 値 | 用途 |
|-----------|-----|------|
| `LINE_LOGIN_CHANNEL_ID` | `2008021453` | LINE Login（OAuth2認証） |
| `LINE_LOGIN_CHANNEL_SECRET` | `[LINE Login用Secret]` | LINE Login（OAuth2認証） |
| `LINE_LOGIN_CALLBACK_URL` | `https://taskmateai.net/agency/` | LINE Login リダイレクト先 |
| `LINE_CHANNEL_SECRET` | `[Messaging API用Secret]` | Webhook署名検証 |
| `LINE_CHANNEL_ACCESS_TOKEN` | `[既存のトークン]` | メッセージ送信 |
| `LINE_OFFICIAL_URL` | `https://line.me/R/ti/p/@[YOUR_BOT_ID]` | 友達追加URL |

---

## 環境変数の更新

### Netlify 環境変数を更新

1. [Netlify Dashboard](https://app.netlify.com/) にログイン
2. TaskMate AI サイトを選択
3. 「Site settings」→「Environment variables」を開く

### 必須の環境変数

以下の環境変数を設定/更新してください:

```bash
# LINE Login（OAuth2認証）
LINE_LOGIN_CHANNEL_ID=2008021453
LINE_LOGIN_CHANNEL_SECRET=[LINE Login用のChannel Secret]
LINE_LOGIN_CALLBACK_URL=https://taskmateai.net/agency/

# Messaging API（メッセージ送信、Webhook）
LINE_CHANNEL_SECRET=[Messaging API用のChannel Secret]
LINE_CHANNEL_ACCESS_TOKEN=[既存のChannel Access Token]

# LINE公式アカウント（友達追加）
LINE_OFFICIAL_URL=https://line.me/R/ti/p/@[YOUR_BOT_ID]

# Supabase
SUPABASE_URL=[既存のURL]
SUPABASE_SERVICE_ROLE_KEY=[既存のKEY]
```

### LINE_OFFICIAL_URL の取得方法

1. LINE Official Account Manager にログイン
2. 該当のアカウントを選択
3. 「設定」→「アカウント設定」→「基本設定」
4. 「友だち追加URL」をコピー

形式: `https://line.me/R/ti/p/@xxxxxxxxx`

### 環境変数更新後の処理

Netlify で環境変数を更新した後、以下を実行:

1. **サイトを再デプロイ**
   ```bash
   cd netlify-tracking
   npm run deploy
   ```

2. または、Netlify Dashboard から「Trigger deploy」→「Deploy site」

---

## テスト手順

### 1. LINE Login のテスト

1. `https://taskmateai.net/agency/` にアクセス
2. 「新規登録」をクリック
3. 代理店情報を入力して送信
4. LINE Login 画面が表示されることを確認
5. LINE アカウントでログイン

**期待される動作:**
- ✅ LINE Login が成功する
- ✅ `agency-complete-registration` 関数が呼ばれる
- ✅ `requires_friend_add: true` が返される
- ✅ LINE 友達追加ページにリダイレクトされる

### 2. 友達追加のテスト

1. 友達追加ページで「追加」をタップ
2. LINE アプリで友達追加を完了

**期待される動作:**
- ✅ Webhook で `follow` イベントが検知される
- ✅ 代理店が自動的に `active` ステータスに変更される
- ✅ ユーザーが自動的に `is_active: true` に変更される
- ✅ LINEに登録完了メッセージが届く

### 3. メッセージ送信のテスト

Netlify Functions ログを確認:

```bash
# Netlify CLI でログを確認
netlify functions:log line-webhook
```

**期待されるログ:**
```
✅ 代理店登録の友達追加を検知: [代理店名]
✅ 代理店をアクティベート
✅ ユーザーをアクティベート
✅ LINEウェルカムメッセージ送信成功
```

### 4. ログイン〜ダッシュボード表示のテスト

1. `https://taskmateai.net/agency/` に戻る
2. メールアドレスとパスワードでログイン
3. ダッシュボードが表示されることを確認

**期待される動作:**
- ✅ ログインが成功する
- ✅ 代理店コード、階層情報が表示される
- ✅ トラッキングリンク作成ができる

---

## トラブルシューティング

### LINE Login は成功するが友達追加URLにリダイレクトされない

**原因:** `agency-complete-registration.js` のレスポンスが正しくない

**確認項目:**
1. Netlify Functions ログで `agency-complete-registration` の実行を確認
2. レスポンスに `requires_friend_add: true` が含まれているか確認
3. `LINE_OFFICIAL_URL` 環境変数が設定されているか確認

### 友達追加してもメッセージが届かない

**原因1:** Webhook URLが間違っている

**解決方法:**
1. LINE Developers Console で Webhook URL を確認
2. 正しいURL: `https://taskmateai.net/.netlify/functions/line-webhook`

**原因2:** Channel Access Token が間違っている

**解決方法:**
1. LINE Developers Console で新しいトークンを発行
2. Netlify 環境変数を更新
3. サイトを再デプロイ

### Webhook が呼ばれない

**確認項目:**
1. LINE Developers Console で「Webhook送信」が「有効」になっているか
2. Webhook URL が正しいか（`https://` で始まっているか）
3. Netlify Functions ログでエラーが出ていないか

---

## 完了チェックリスト

統一作業が完了したら、以下をチェックしてください:

- [ ] Messaging API チャンネルで LINE Login が有効化された
- [ ] Callback URL が設定された
- [ ] Netlify 環境変数が更新された（6個）
- [ ] サイトが再デプロイされた
- [ ] LINE Login のテストが成功した
- [ ] 友達追加のテストが成功した
- [ ] ウェルカムメッセージが届いた
- [ ] ログイン〜ダッシュボード表示が成功した

すべてチェックが完了したら、チャンネル統一は完了です！

---

## 参考リンク

- [LINE Developers Console](https://developers.line.biz/console/)
- [LINE Login ドキュメント](https://developers.line.biz/ja/docs/line-login/)
- [Messaging API ドキュメント](https://developers.line.biz/ja/docs/messaging-api/)
- [Netlify Functions ドキュメント](https://docs.netlify.com/functions/overview/)
