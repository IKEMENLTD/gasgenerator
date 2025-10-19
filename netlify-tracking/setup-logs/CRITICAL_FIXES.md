# 🚨 LINE Login 致命的な問題と修正

**発見日時:** 2025-10-19 15:42
**重要度:** ⚠️⚠️⚠️ **CRITICAL**

---

## 発見された問題

### ❌ 問題1: Callback URLのデフォルト値が間違っている

**ファイル:** `netlify/functions/agency-get-line-url.js` (line 148)

**問題のコード:**
```javascript
const callbackUrl = process.env.LINE_LOGIN_CALLBACK_URL || 'https://taskmateai.net/agency/line-callback';
```

**問題点:**
- デフォルト値が `/agency/line-callback` になっている
- フロントエンドは `/agency/` でコールバックを処理している
- 環境変数が未設定の場合、LINE Loginが失敗する

**修正内容:**
```javascript
const callbackUrl = process.env.LINE_LOGIN_CALLBACK_URL || 'https://taskmateai.net/agency/';
```

**影響:**
- 環境変数が正しく設定されていない場合、LINE Loginが完全に動作しない
- ユーザーは無限ループまたはエラーページに遭遇する可能性

---

### ❌ 問題2: LINE Login スコープに不要な `email` が含まれている

**ファイル:** `netlify/functions/utils/line-client.js` (line 31)

**問題のコード:**
```javascript
scope: 'profile openid email',
```

**問題点:**
- `email` スコープは追加の設定が必要（LINE Developers Console）
- メールアドレスは必須ではない
- 設定されていない場合、スコープエラーが発生する可能性

**修正内容:**
```javascript
scope: 'profile openid',
```

**影響:**
- LINE Loginの承認画面でエラーが発生する可能性
- ユーザー体験の低下

---

## 必須確認事項

### ✅ Netlify 環境変数の確認

以下の環境変数が**正しく**設定されているか確認してください：

```bash
LINE_LOGIN_CALLBACK_URL=https://taskmateai.net/agency/
```

**確認方法:**
1. Netlify Dashboard を開く
2. Site settings → Environment variables
3. `LINE_LOGIN_CALLBACK_URL` の値を確認
4. 値が `https://taskmateai.net/agency/` であることを確認（末尾の `/` 必須）

**⚠️ 注意:**
- 値の末尾に `/` があること
- `https://` で始まること
- `/agency/line-callback` ではないこと

---

### ✅ LINE Developers Console の Callback URL 設定

**LINE Developers Console で設定すべき値:**

1. LINE Developers Console を開く
   - https://developers.line.biz/console/

2. Messaging API チャンネル (2008021453) を選択

3. 「LINE Login」タブを開く

4. 「Callback URL」に以下を設定:
   ```
   https://taskmateai.net/agency/
   ```

**⚠️ 重要:**
- 末尾の `/` は必須
- `https://taskmateai.net/agency/line-callback` ではありません
- 開発環境用に `http://localhost:8888/agency/` も追加推奨

---

## 修正後の動作確認

### テスト手順

1. **新規登録をテスト**
   ```
   https://taskmateai.net/agency/
   ```
   - 「新規登録」をクリック
   - 代理店情報を入力
   - 「登録する」をクリック

2. **LINE Login が正しく動作することを確認**
   - LINE Login 画面が表示される
   - スコープ: 「プロフィール情報」のみ（メールアドレスは表示されない）
   - ログイン成功

3. **Callback が正しく処理されることを確認**
   - `https://taskmateai.net/agency/?code=xxx&state=xxx` にリダイレクトされる
   - ローディング画面が表示される
   - 友達追加ページにリダイレクトされる

4. **友達追加をテスト**
   - LINE アプリで友達追加
   - ウェルカムメッセージを受信

5. **ログインをテスト**
   - `https://taskmateai.net/agency/` に戻る
   - メールアドレスとパスワードでログイン
   - ダッシュボードが表示される

---

## エラーが発生した場合

### エラー1: "Invalid redirect_uri"

**原因:**
- LINE Developers Console の Callback URL が間違っている
- または、環境変数 `LINE_LOGIN_CALLBACK_URL` が間違っている

**解決方法:**
1. LINE Developers Console で Callback URL を確認
2. `https://taskmateai.net/agency/` に設定されているか確認
3. Netlify 環境変数を確認
4. サイトを再デプロイ

---

### エラー2: "Invalid scope"

**原因:**
- スコープに `email` が含まれているが、LINE Developers Console で有効化されていない

**解決方法:**
1. コードを修正済み（`email` を削除）
2. サイトを再デプロイ

---

### エラー3: Callback が処理されない（無限ループ）

**原因:**
- Callback URL のデフォルト値が `/agency/line-callback` になっていた
- フロントエンドは `/agency/` でコールバックを処理している

**解決方法:**
1. コードを修正済み（デフォルト値を `/agency/` に変更）
2. サイトを再デプロイ

---

## GitHubへのコミット

修正をコミットしてプッシュしてください：

```bash
git add netlify-tracking/netlify/functions/agency-get-line-url.js
git add netlify-tracking/netlify/functions/utils/line-client.js
git commit -m "Fix LINE Login callback URL and scope issues

- Fix default callback URL from /agency/line-callback to /agency/
- Remove email scope (only profile and openid required)
- Align with frontend callback handling

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

---

## 修正完了チェックリスト

- [x] `agency-get-line-url.js` のデフォルトCallback URLを修正
- [x] `line-client.js` のスコープから `email` を削除
- [ ] Netlify 環境変数 `LINE_LOGIN_CALLBACK_URL` を確認
- [ ] LINE Developers Console の Callback URL を確認
- [ ] GitHubにコミット＆プッシュ
- [ ] Netlifyで自動デプロイ完了を確認
- [ ] テスト実施（新規登録 → LINE Login → 友達追加 → ログイン）

---

## 補足: なぜこの問題が発生したのか

1. **Callback URLの不一致:**
   - 開発初期に `/agency/line-callback` を使う設計だった可能性
   - その後、フロントエンドを `/agency/` で処理するように変更
   - しかし、デフォルト値の更新を忘れた

2. **emailスコープの誤設定:**
   - LINE Loginでメールアドレスも取得しようとした
   - しかし、メールアドレスは必須ではなく、追加設定が必要
   - 不要なので削除

---

**最終更新:** 2025-10-19 15:45
**修正者:** Claude Code
