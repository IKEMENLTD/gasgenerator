# LINE チャンネル統一 ステップバイステップガイド

**作業者:** _________________
**作業日時:** _________________

---

## 🎯 目的

LINE Login チャンネル (2008314222) と Messaging API チャンネル (2008021453) を統一し、**Messaging API チャンネル1つ**で以下の機能を実現:
- LINE Login（OAuth2認証）
- Messaging API（メッセージ送信、Webhook受信）

---

## 📋 事前準備

### 必要なアクセス権限

- [ ] LINE Developers Console へのアクセス権限
- [ ] LINE Official Account Manager へのアクセス権限
- [ ] Netlify Dashboard へのアクセス権限

### 必要なツール

- [ ] Netlify CLI インストール済み (`npm install -g netlify-cli`)
- [ ] テキストエディタ（メモ帳、VS Code など）
- [ ] ブラウザ（Chrome、Firefox など）

---

## PART 1: LINE Developers Console での作業

### 📍 STEP 1-1: LINE Developers Console にアクセス

1. **ブラウザで以下のURLを開く:**
   ```
   https://developers.line.biz/console/
   ```

2. **LINEアカウントでログイン**
   - [ ] ログイン完了

3. **Provider を選択**
   - Provider名: _________________
   - [ ] Provider選択完了

4. **Messaging API チャンネルを選択**
   - チャンネル名: _________________
   - チャンネルID: `2008021453`
   - [ ] チャンネル選択完了

**⚠️ スクリーンショット保存:**
- [ ] チャンネル一覧のスクリーンショットを保存
- 保存場所: _________________

---

### 📍 STEP 1-2: 現在の設定をバックアップ

1. **Basic settings タブを開く**
   - [ ] Basic settings 画面を開いた

2. **スクリーンショットを保存**
   - [ ] Channel ID をスクリーンショット
   - [ ] Channel secret をスクリーンショット
   - [ ] Webhook settings をスクリーンショット

3. **Messaging API settings タブを開く**
   - [ ] Messaging API settings 画面を開いた

4. **スクリーンショットを保存**
   - [ ] Channel access token をスクリーンショット
   - [ ] Webhook URL をスクリーンショット

**保存したスクリーンショット:**
- `backup-basic-settings.png`
- `backup-messaging-api-settings.png`

---

### 📍 STEP 1-3: LINE Login を有効化

1. **LINE Login タブをクリック**
   - [ ] LINE Login タブを開いた

2. **「LINE Login を有効にする」ボタンをクリック**
   - [ ] ボタンをクリック
   - [ ] 確認ダイアログが表示された場合は「OK」をクリック

3. **有効化を確認**
   - [ ] LINE Login タブが表示されることを確認
   - [ ] 「LINE Login settings」セクションが表示されることを確認

**⚠️ スクリーンショット保存:**
- [ ] LINE Login 有効化後の画面をスクリーンショット
- 保存場所: _________________

**作業時刻:** _________________

---

### 📍 STEP 1-4: Callback URL を設定

1. **LINE Login タブ内の「Callback URL」セクションを探す**
   - [ ] Callback URL 設定エリアを見つけた

2. **以下のURLを追加**

   **本番環境用:**
   ```
   https://taskmateai.net/agency/
   ```
   - [ ] URL入力
   - [ ] 「Add」または「登録」ボタンをクリック
   - [ ] 追加されたことを確認

   **開発環境用（オプション）:**
   ```
   http://localhost:8888/agency/
   ```
   - [ ] URL入力
   - [ ] 「Add」または「登録」ボタンをクリック
   - [ ] 追加されたことを確認

3. **設定を保存**
   - [ ] 「Update」または「保存」ボタンをクリック

**登録したCallback URL:**
1. `https://taskmateai.net/agency/`
2. `http://localhost:8888/agency/`

**⚠️ スクリーンショット保存:**
- [ ] Callback URL設定後の画面をスクリーンショット

**作業時刻:** _________________

---

### 📍 STEP 1-5: スコープを設定

1. **LINE Login タブ内の「Scopes」セクションを探す**
   - [ ] Scopes 設定エリアを見つけた

2. **以下のスコープを有効化**

   - [ ] ✅ `profile` (ユーザーID、表示名、プロフィール画像)
   - [ ] ✅ `openid` (OpenID Connect用)

3. **設定を保存**
   - [ ] 「Update」または「保存」ボタンをクリック

**有効化したスコープ:**
- `profile`: ✅
- `openid`: ✅

**⚠️ スクリーンショット保存:**
- [ ] Scopes設定後の画面をスクリーンショット

**作業時刻:** _________________

---

### 📍 STEP 1-6: Channel ID と Channel Secret を取得

#### LINE Login の情報

1. **LINE Login タブを開く**
   - [ ] LINE Login タブを表示

2. **Channel ID を確認**
   - 表示されているChannel ID: _________________
   - ✅ Messaging API の Channel ID (2008021453) と同じであることを確認
   - [ ] 確認完了

3. **Channel Secret を取得**
   - [ ] 「Channel secret」の「Show」または「表示」ボタンをクリック
   - Channel Secret: _________________
   - [ ] 安全な場所にコピー（パスワードマネージャー推奨）

**⚠️ 重要:**
- この Channel Secret は **LINE Login 用** です
- Messaging API の Channel Secret とは **異なります**
- 絶対にGitにコミットしないでください

#### Messaging API の情報

1. **Messaging API タブを開く**
   - [ ] Messaging API タブを表示

2. **Channel Secret を確認**
   - [ ] Basic settings タブで Channel secret を確認
   - Channel Secret: _________________
   - [ ] 安全な場所にコピー

3. **Channel Access Token を確認**
   - [ ] Messaging API settings タブを開く
   - [ ] Channel access token の「Issue」または「再発行」ボタンをクリック（既存のトークンがある場合はスキップ）
   - Channel Access Token: _________________
   - [ ] 安全な場所にコピー

**取得した認証情報まとめ:**

| 項目 | 値 | 用途 |
|------|-----|------|
| Channel ID | 2008021453 | LINE Login と Messaging API で共通 |
| LINE Login Channel Secret | _________ | LINE Login 認証用 |
| Messaging API Channel Secret | _________ | Webhook 署名検証用 |
| Channel Access Token | _________ | メッセージ送信用 |

**作業時刻:** _________________

---

### 📍 STEP 1-7: LINE公式アカウント友達追加URLを取得

1. **LINE Official Account Manager を開く**
   ```
   https://manager.line.biz/
   ```

2. **該当のアカウントを選択**
   - アカウント名: _________________
   - [ ] アカウント選択完了

3. **「設定」→「アカウント設定」→「基本設定」を開く**
   - [ ] 基本設定ページを開いた

4. **「友だち追加URL」をコピー**
   - 友だち追加URL: _________________
   - 形式確認: `https://line.me/R/ti/p/@` で始まっている ✅
   - [ ] URLをコピー

**取得したURL:**
```
https://line.me/R/ti/p/@_________________
```

**⚠️ スクリーンショット保存:**
- [ ] 友だち追加URL の画面をスクリーンショット

**作業時刻:** _________________

---

## PART 2: Netlify 環境変数の設定

### 📍 STEP 2-1: Netlify プロジェクトにリンク

1. **ターミナル（コマンドプロンプト）を開く**
   - [ ] ターミナルを起動

2. **プロジェクトディレクトリに移動**
   ```bash
   cd /mnt/c/Users/ooxmi/Downloads/gas-generator/netlify-tracking
   ```
   - [ ] ディレクトリ移動完了

3. **Netlify にログイン**
   ```bash
   netlify login
   ```
   - [ ] ブラウザが開いてログイン画面が表示された
   - [ ] 「Authorize」をクリック
   - [ ] ログイン成功メッセージを確認

4. **Netlify プロジェクトにリンク**
   ```bash
   netlify link
   ```
   - 表示された選択肢から適切なオプションを選択:
     - 既存のサイトにリンクする場合: 「Link to an existing site」
     - サイト名: `taskmateai.net` を選択
   - [ ] リンク成功メッセージを確認

**作業時刻:** _________________

---

### 📍 STEP 2-2: 現在の環境変数をバックアップ

1. **環境変数をファイルに出力**
   ```bash
   netlify env:list > setup-logs/env-backup-before.txt
   ```
   - [ ] コマンド実行完了

2. **バックアップファイルを確認**
   ```bash
   cat setup-logs/env-backup-before.txt
   ```
   - [ ] ファイル内容を確認
   - [ ] 既存の環境変数が表示されることを確認

**バックアップファイル:**
- `setup-logs/env-backup-before.txt`

**作業時刻:** _________________

---

### 📍 STEP 2-3: 環境変数を設定（自動スクリプト使用）

#### オプション A: 自動セットアップスクリプトを使用

1. **セットアップヘルパースクリプトを実行**
   ```bash
   ./setup-logs/setup-helper.sh
   ```

2. **画面の指示に従って情報を入力**
   - STEP 1-6、1-7 で取得した情報を入力
   - 入力内容を確認後、「y」で設定開始

3. **設定完了を確認**
   - すべての環境変数が「✅ 設定成功」となることを確認

#### オプション B: 手動で環境変数を設定（スクリプトが使えない場合）

以下のコマンドを1つずつ実行してください:

1. **LINE_LOGIN_CHANNEL_ID を設定**
   ```bash
   netlify env:set LINE_LOGIN_CHANNEL_ID "2008021453"
   ```
   - [ ] 実行完了
   - [ ] 成功メッセージを確認

2. **LINE_LOGIN_CHANNEL_SECRET を設定**
   ```bash
   netlify env:set LINE_LOGIN_CHANNEL_SECRET "ここにLINE Login用のSecretを入力"
   ```
   - [ ] 実行完了
   - [ ] 成功メッセージを確認

3. **LINE_LOGIN_CALLBACK_URL を設定**
   ```bash
   netlify env:set LINE_LOGIN_CALLBACK_URL "https://taskmateai.net/agency/"
   ```
   - [ ] 実行完了
   - [ ] 成功メッセージを確認

4. **LINE_CHANNEL_SECRET を設定**
   ```bash
   netlify env:set LINE_CHANNEL_SECRET "ここにMessaging API用のSecretを入力"
   ```
   - [ ] 実行完了
   - [ ] 成功メッセージを確認

5. **LINE_CHANNEL_ACCESS_TOKEN を設定**
   ```bash
   netlify env:set LINE_CHANNEL_ACCESS_TOKEN "ここにChannel Access Tokenを入力"
   ```
   - [ ] 実行完了
   - [ ] 成功メッセージを確認

6. **LINE_OFFICIAL_URL を設定**
   ```bash
   netlify env:set LINE_OFFICIAL_URL "https://line.me/R/ti/p/@xxxxxxxxx"
   ```
   - [ ] 実行完了
   - [ ] 成功メッセージを確認

**設定完了した環境変数:**
- [ ] LINE_LOGIN_CHANNEL_ID
- [ ] LINE_LOGIN_CHANNEL_SECRET
- [ ] LINE_LOGIN_CALLBACK_URL
- [ ] LINE_CHANNEL_SECRET
- [ ] LINE_CHANNEL_ACCESS_TOKEN
- [ ] LINE_OFFICIAL_URL

**作業時刻:** _________________

---

### 📍 STEP 2-4: 環境変数の設定を確認

1. **すべての環境変数を一覧表示**
   ```bash
   netlify env:list
   ```
   - [ ] LINE関連の環境変数が6つ表示されることを確認

2. **個別に値を確認**
   ```bash
   netlify env:get LINE_LOGIN_CHANNEL_ID
   netlify env:get LINE_LOGIN_CHANNEL_SECRET
   netlify env:get LINE_LOGIN_CALLBACK_URL
   netlify env:get LINE_CHANNEL_SECRET
   netlify env:get LINE_CHANNEL_ACCESS_TOKEN
   netlify env:get LINE_OFFICIAL_URL
   ```
   - [ ] すべての値が正しく設定されていることを確認

3. **確認結果をファイルに保存**
   ```bash
   netlify env:list > setup-logs/env-backup-after.txt
   ```
   - [ ] ファイル作成完了

**確認結果:**

| 環境変数名 | 設定状態 | 値の確認 |
|-----------|---------|---------|
| LINE_LOGIN_CHANNEL_ID | ✅ / ❌ | 2008021453 |
| LINE_LOGIN_CHANNEL_SECRET | ✅ / ❌ | [設定済み] |
| LINE_LOGIN_CALLBACK_URL | ✅ / ❌ | https://taskmateai.net/agency/ |
| LINE_CHANNEL_SECRET | ✅ / ❌ | [設定済み] |
| LINE_CHANNEL_ACCESS_TOKEN | ✅ / ❌ | [設定済み] |
| LINE_OFFICIAL_URL | ✅ / ❌ | https://line.me/R/ti/p/@... |

**作業時刻:** _________________

---

## PART 3: デプロイとテスト

### 📍 STEP 3-1: サイトを再デプロイ

環境変数を反映するには、サイトを再デプロイする必要があります。

#### オプション A: Netlify CLI でデプロイ

1. **デプロイコマンドを実行**
   ```bash
   npm run deploy
   ```
   - [ ] ビルドプロセスが開始された
   - [ ] ビルド成功を確認
   - [ ] デプロイ成功を確認

2. **デプロイURLを確認**
   - デプロイURL: _________________
   - [ ] URLをブラウザで開いて確認

#### オプション B: Netlify Dashboard でデプロイ

1. **Netlify Dashboard を開く**
   ```
   https://app.netlify.com/
   ```

2. **TaskMate AI サイトを選択**
   - [ ] サイト選択完了

3. **「Deploys」タブを開く**
   - [ ] Deploys ページを開いた

4. **「Trigger deploy」→「Deploy site」をクリック**
   - [ ] デプロイが開始された
   - [ ] デプロイ完了を待つ（数分かかる場合があります）
   - [ ] 「Published」ステータスになることを確認

**デプロイ情報:**
- デプロイ開始時刻: _________________
- デプロイ完了時刻: _________________
- デプロイID: _________________
- ステータス: ✅ SUCCESS / ❌ FAILED

**作業時刻:** _________________

---

### 📍 STEP 3-2: LINE Login のテスト

1. **ブラウザで代理店登録ページを開く**
   ```
   https://taskmateai.net/agency/
   ```
   - [ ] ページが正常に表示された

2. **「新規登録」をクリック**
   - [ ] 登録フォームが表示された

3. **テストデータを入力**
   ```
   会社名: テスト株式会社
   代理店名: テスト代理店
   住所: 東京都渋谷区1-1-1
   担当者名: テスト太郎
   メールアドレス: test_20251019@example.com
   電話番号: 03-1234-5678
   パスワード: Test1234!@#$
   パスワード確認: Test1234!@#$
   招待コード: (空白)
   ```
   - [ ] すべての項目を入力

4. **「利用規約に同意する」にチェック**
   - [ ] チェック完了

5. **「登録する」ボタンをクリック**
   - [ ] ボタンクリック完了
   - [ ] ローディング表示を確認

6. **LINE Login 画面が表示されることを確認**
   - [ ] LINE Login 画面が表示された
   - [ ] 「ログイン」ボタンが表示されている

7. **LINE アカウントでログイン**
   - [ ] メールアドレスとパスワードを入力
   - [ ] 「ログイン」をクリック
   - [ ] 認証成功を確認

**テスト結果:**
- LINE Login画面表示: ✅ OK / ❌ NG
- ログイン成功: ✅ OK / ❌ NG
- エラーメッセージ: _________________

**⚠️ エラーが発生した場合:**
- エラーメッセージ全文をコピー: _________________
- スクリーンショットを保存: _________________
- STEP 4 のトラブルシューティングを参照

**作業時刻:** _________________

---

### 📍 STEP 3-3: 友達追加のテスト

1. **LINE 友達追加ページが表示されることを確認**
   - [ ] LINE公式アカウントの友達追加ページが自動的に開いた
   - アカウント名: _________________

2. **「追加」ボタンをタップ**
   - [ ] ボタンをタップ
   - [ ] LINE アプリが起動した

3. **LINE アプリで友達追加を完了**
   - [ ] 友達追加完了

**テスト結果:**
- 友達追加ページ表示: ✅ OK / ❌ NG
- 友達追加完了: ✅ OK / ❌ NG

**作業時刻:** _________________

---

### 📍 STEP 3-4: ウェルカムメッセージの確認

1. **LINE アプリを開く**
   - [ ] LINE アプリを起動

2. **TaskMate AI からのメッセージを確認**
   - [ ] メッセージが届いている

3. **メッセージ内容を確認**
   - [ ] ✅ 成功メッセージ（緑色のヘッダー）
   - [ ] 代理店名が表示されている: _________________
   - [ ] 代理店コードが表示されている: _________________
   - [ ] 次のステップガイドが表示されている
   - [ ] ダッシュボードボタンが表示されている

**メッセージ内容:**
- 代理店名: _________________
- 代理店コード: _________________
- メッセージ受信時刻: _________________

**テスト結果:**
- メッセージ受信: ✅ OK / ❌ NG
- 内容正確性: ✅ OK / ❌ NG

**⚠️ メッセージが届かない場合:**
- 5分待ってから再確認
- Netlify Functions ログを確認（STEP 3-5）
- STEP 4 のトラブルシューティングを参照

**作業時刻:** _________________

---

### 📍 STEP 3-5: Netlify Functions ログの確認

1. **line-webhook のログを確認**
   ```bash
   netlify functions:log line-webhook
   ```
   - [ ] ログ表示完了

**期待されるログ:**
```
✅ 代理店登録の友達追加を検知: テスト代理店
✅ 代理店をアクティベート
✅ ユーザーをアクティベート
✅ LINEウェルカムメッセージ送信成功
```

**実際のログ:**
```
_________________
```

2. **agency-complete-registration のログを確認**
   ```bash
   netlify functions:log agency-complete-registration
   ```
   - [ ] ログ表示完了

**期待されるログ:**
```
✅ Registration completed successfully
🔄 Redirecting to LINE friend add page...
```

**実際のログ:**
```
_________________
```

**ログ確認結果:**
- line-webhook: ✅ 正常 / ❌ エラー
- agency-complete-registration: ✅ 正常 / ❌ エラー
- エラー内容: _________________

**作業時刻:** _________________

---

### 📍 STEP 3-6: ログイン〜ダッシュボード表示のテスト

1. **ブラウザで代理店ページを開く**
   ```
   https://taskmateai.net/agency/
   ```
   - [ ] ページが表示された

2. **ログインフォームにテストアカウント情報を入力**
   ```
   メールアドレス: test_20251019@example.com
   パスワード: Test1234!@#$
   ```
   - [ ] 入力完了

3. **「ログイン」ボタンをクリック**
   - [ ] ボタンクリック
   - [ ] ローディング表示

4. **ダッシュボードが表示されることを確認**
   - [ ] ダッシュボード表示成功

5. **表示内容を確認**
   - [ ] 代理店名: _________________
   - [ ] 代理店コード: _________________
   - [ ] 階層レベル: _________________
   - [ ] 自己報酬率: _________________
   - [ ] 招待コード: _________________

**テスト結果:**
- ログイン成功: ✅ OK / ❌ NG
- ダッシュボード表示: ✅ OK / ❌ NG
- 情報表示正確性: ✅ OK / ❌ NG

**作業時刻:** _________________

---

## PART 4: トラブルシューティング

### エラー1: LINE Login で "Invalid client_id" エラー

**原因:** `LINE_LOGIN_CHANNEL_ID` が間違っている

**確認方法:**
1. LINE Developers Console で Channel ID を再確認
2. Netlify 環境変数の値を確認:
   ```bash
   netlify env:get LINE_LOGIN_CHANNEL_ID
   ```

**解決方法:**
```bash
netlify env:unset LINE_LOGIN_CHANNEL_ID
netlify env:set LINE_LOGIN_CHANNEL_ID "2008021453"
netlify deploy --prod
```

---

### エラー2: LINE Login は成功するが友達追加ページにリダイレクトされない

**原因:** `LINE_OFFICIAL_URL` が設定されていない、または間違っている

**確認方法:**
```bash
netlify env:get LINE_OFFICIAL_URL
```

**解決方法:**
```bash
netlify env:set LINE_OFFICIAL_URL "https://line.me/R/ti/p/@xxxxxxxxx"
netlify deploy --prod
```

---

### エラー3: 友達追加したがメッセージが届かない

**原因1:** `LINE_CHANNEL_ACCESS_TOKEN` が間違っている、または期限切れ

**解決方法:**
1. LINE Developers Console で新しいトークンを発行
2. 環境変数を更新:
   ```bash
   netlify env:set LINE_CHANNEL_ACCESS_TOKEN "新しいトークン"
   netlify deploy --prod
   ```

**原因2:** Webhook URL が間違っている

**確認方法:**
1. LINE Developers Console → Messaging API settings → Webhook URL を確認
2. 正しいURL: `https://taskmateai.net/.netlify/functions/line-webhook`

**解決方法:**
1. LINE Developers Console で Webhook URL を修正
2. Webhook送信を「有効」にする

---

### エラー4: ダッシュボードにログインできない

**原因:** 代理店が `active` ステータスになっていない

**確認方法:**
1. Supabase Dashboard を開く
2. `agencies` テーブルを確認
3. テストアカウントの `status` カラムを確認

**解決方法:**
1. 友達追加を再度実行
2. Netlify Functions ログで Webhook が正しく動作しているか確認
3. 必要に応じて手動で `status` を `active` に変更

---

## PART 5: クリーンアップ

### 📍 STEP 5-1: テストアカウントの削除

本番運用開始前に、テストアカウントを削除します。

1. **Supabase Dashboard を開く**
   ```
   https://app.supabase.com/
   ```

2. **プロジェクトを選択**
   - [ ] プロジェクト選択完了

3. **Table Editor を開く**
   - [ ] Table Editor ページを開いた

4. **`agencies` テーブルを開く**
   - [ ] テーブルを開いた

5. **テストアカウントを探す**
   - メールアドレス: `test_20251019@example.com`
   - [ ] レコードを見つけた

6. **レコードを削除**
   - [ ] 削除ボタンをクリック
   - [ ] 確認ダイアログで「Delete」をクリック
   - [ ] 削除完了を確認

7. **`agency_users` テーブルからも削除**
   - [ ] `agency_users` テーブルを開く
   - [ ] テストアカウントに紐づくユーザーを削除

**削除完了時刻:** _________________

---

### 📍 STEP 5-2: 旧 LINE Login チャンネルの確認

1. **LINE Developers Console を開く**
   - [ ] Console にアクセス

2. **旧 LINE Login チャンネル (2008314222) を選択**
   - [ ] チャンネルを選択

3. **使用状況を確認**
   - [ ] 現在使用されていないことを確認
   - [ ] 必要に応じてチャンネルを削除または無効化

**処理内容:**
- [ ] 削除
- [ ] 無効化
- [ ] 保留（理由: _________________）

**作業時刻:** _________________

---

## 完了チェックリスト

すべての項目にチェックが入ったら、チャンネル統一作業は完了です！

### LINE Developers Console
- [ ] Messaging API チャンネルで LINE Login が有効化された
- [ ] Callback URL: `https://taskmateai.net/agency/` が設定された
- [ ] Scopes: `profile`, `openid` が設定された
- [ ] LINE Login Channel Secret を取得した
- [ ] Messaging API Channel Secret を確認した
- [ ] Channel Access Token を確認した

### LINE Official Account Manager
- [ ] 友だち追加URLを取得した

### Netlify 環境変数
- [ ] LINE_LOGIN_CHANNEL_ID = `2008021453`
- [ ] LINE_LOGIN_CHANNEL_SECRET (設定済み)
- [ ] LINE_LOGIN_CALLBACK_URL = `https://taskmateai.net/agency/`
- [ ] LINE_CHANNEL_SECRET (設定済み)
- [ ] LINE_CHANNEL_ACCESS_TOKEN (設定済み)
- [ ] LINE_OFFICIAL_URL (設定済み)

### デプロイ
- [ ] サイトが正常に再デプロイされた

### テスト
- [ ] LINE Login のテスト成功
- [ ] 友達追加のテスト成功
- [ ] ウェルカムメッセージ受信成功
- [ ] ログイン〜ダッシュボード表示成功
- [ ] Netlify Functions ログ確認（エラーなし）

### クリーンアップ
- [ ] テストアカウントを削除した
- [ ] 旧 LINE Login チャンネルの処理完了

---

## 作業完了

**作業完了日時:** _________________
**作業担当者:** _________________
**最終確認者:** _________________

**備考:**
_________________
_________________
_________________

---

## バックアップファイル一覧

- [ ] `setup-logs/env-backup-before.txt` - 設定前の環境変数
- [ ] `setup-logs/env-backup-after.txt` - 設定後の環境変数
- [ ] `setup-logs/setup-log-YYYYMMDD_HHMMSS.log` - セットアップログ
- [ ] スクリーンショット類

---

**お疲れ様でした！ LINEチャンネル統一が完了しました。**
