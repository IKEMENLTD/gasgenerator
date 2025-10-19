# 🚨 致命的なバグ発見レポート

**発見日時:** 2025-10-19 16:15
**重要度:** ⚠️⚠️⚠️ **CRITICAL - 最優先修正**

---

## 発見された問題

### ❌ **問題: line-webhook.js が間違った Supabase キーを使用**

**ファイル:** `netlify/functions/line-webhook.js` (line 5-8)

**問題のコード (修正前):**
```javascript
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY  // ❌ 間違い！
);
```

**修正後のコード:**
```javascript
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY  // ✅ 正しい
);
```

---

## 問題の詳細

### なぜこれが問題なのか

1. **Webhookはサーバー側の処理**
   - LINE サーバーから直接呼ばれるサーバー側の処理
   - クライアント側のブラウザからは呼ばれない

2. **ANON_KEY はクライアント側（ブラウザ）用**
   - `SUPABASE_ANON_KEY` はブラウザで使用するための公開キー
   - Row Level Security (RLS) の制約を受ける
   - テーブルへの書き込み権限が制限される

3. **代理店のアクティベーション処理が失敗する**
   - `line-webhook.js` の `handleFollowEvent` 関数（line 148-173）
   - `agencies` テーブルの `status` を `active` に更新する必要がある
   - `agency_users` テーブルの `is_active` を `true` に更新する必要がある
   - ANON_KEY では RLS により書き込みが拒否される可能性が高い

4. **SERVICE_ROLE_KEY を使用すべき**
   - サーバー側の処理では `SUPABASE_SERVICE_ROLE_KEY` を使用
   - RLS を無視して全テーブルにアクセス可能
   - セキュアな環境（Netlify Functions）でのみ使用

---

## 影響範囲

### 直接的な影響

1. **友達追加しても代理店がアクティブにならない**
   - ユーザーが LINE Bot を友達追加
   - Webhook が呼ばれる
   - しかし、代理店の `status` が `pending_friend_add` のまま
   - `agency_users` の `is_active` も `false` のまま

2. **ログインが失敗する**
   - ユーザーがメールアドレス＆パスワードでログイン
   - `agency-auth.js` が代理店の `status` をチェック（line 172）
   - `status !== 'active'` のため、エラーを返す
   - エラーメッセージ: 「この代理店アカウントはまだ有効化されていません。LINE公式アカウントを友達追加してください。」

3. **ユーザーは無限ループに陥る**
   - LINE Login → 友達追加 → ログイン試行 → エラー → 友達追加を促される → 既に友達 → エラー → ...

---

## 根本原因

### これが「LINE Login → パスワード間違い」エラーの原因

**ユーザーが報告した問題:**
> 「ログイン時のLINEログイン機能が機能しているようで機能していなさそう」
> 「LINEログイン確認中→メアドパスワードが間違ってますになっちゃう」

**実際に起きていたこと:**
1. LINE Login は成功している（`agency-complete-registration.js` まで完了）
2. 代理店レコードに `line_user_id` が設定される
3. `status` が `pending_friend_add` に変更される
4. ユーザーが友達追加する
5. **Webhook が呼ばれるが、ANON_KEY のため代理店をアクティブ化できない**
6. `status` が `pending_friend_add` のまま残る
7. ログイン時に `status !== 'active'` のためエラーになる
8. エラーメッセージが「代理店アカウントはまだ有効化されていません」
9. **しかし、以前のコードでは「メールアドレスまたはパスワードが間違っています」と表示されていた**

---

## 修正内容

### 1. Supabase クライアントの初期化を修正

**ファイル:** `netlify/functions/line-webhook.js`

**変更箇所 1: Supabase初期化（line 5-10）**
```javascript
// 修正前
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// 修正後
// Initialize Supabase client with SERVICE_ROLE_KEY
// IMPORTANT: Webhooks are server-side operations that need full database access
// ANON_KEY would be restricted by Row Level Security (RLS)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

**変更箇所 2: 環境変数のバリデーション（line 711-714）**
```javascript
// 修正前
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY');
}

// 修正後
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
}
```

---

## テスト計画

### 修正後のテスト手順

1. **環境変数の確認**
   - Netlify Dashboard で `SUPABASE_SERVICE_ROLE_KEY` が設定されているか確認
   - この変数は既に他のFunctionsで使用されているため、設定済みのはず

2. **デプロイ**
   - GitHubにプッシュ
   - Netlifyで自動デプロイ完了を待つ

3. **新規登録テスト**
   - https://taskmateai.net/agency/ で新規登録
   - LINE Login を実行
   - 友達追加ページにリダイレクトされることを確認
   - LINE Bot を友達追加
   - **ウェルカムメッセージが届くことを確認**（重要）

4. **ログインテスト**
   - https://taskmateai.net/agency/ に戻る
   - 登録したメールアドレス＆パスワードでログイン
   - **ログインが成功することを確認**（これが今まで失敗していた）
   - ダッシュボードが表示されることを確認

5. **Netlify Functions ログの確認**
   - Netlify Dashboard → Functions → line-webhook
   - ログに以下が表示されることを確認:
     ```
     ✅ 代理店をアクティブ化しました
     ✅ ユーザーをアクティブ化しました
     ✅ 代理店ウェルカムメッセージ送信完了
     ```

---

## 予想される結果

### 修正前（現在の状態）

1. LINE Login 成功
2. 友達追加 → Webhook呼ばれる → **アクティベーション失敗（ANON_KEYのため）**
3. ログイン試行 → 「代理店アカウントはまだ有効化されていません」エラー
4. ユーザーは困惑する

### 修正後（期待される動作）

1. LINE Login 成功
2. 友達追加 → Webhook呼ばれる → **アクティベーション成功（SERVICE_ROLE_KEYのため）**
3. ウェルカムメッセージ受信
4. ログイン試行 → **成功！**
5. ダッシュボード表示

---

## 補足: なぜ今まで気づかなかったのか

1. **エラーログが不十分だった**
   - Webhook でエラーが起きても、フロントエンドには伝わらない
   - Netlify Functions のログを確認する必要があった

2. **エラーメッセージが誤解を招いていた**
   - 「メールアドレスまたはパスワードが間違っています」
   - 実際は「代理店がまだアクティブになっていない」
   - **今回のログ追加でエラーメッセージを改善した**

3. **テストが不十分だった**
   - Webhook のアクティベーション処理をテストしていなかった
   - ログインまでの完全なフローをテストしていなかった

4. **ANON_KEY vs SERVICE_ROLE_KEY の違いを理解していなかった**
   - Supabase の RLS の仕組みを十分に理解していなかった
   - サーバー側の処理では SERVICE_ROLE_KEY を使うべきだった

---

## 今後の改善策

1. **Webhook のログを強化**
   - アクティベーション成功/失敗を明確にログに記録
   - Netlify Functions のログを定期的に確認

2. **エンドツーエンドテストの実施**
   - 新規登録 → LINE Login → 友達追加 → ログイン の完全なフローをテスト
   - 各ステップでデータベースの状態を確認

3. **環境変数の使用方法を統一**
   - サーバー側: `SUPABASE_SERVICE_ROLE_KEY`
   - クライアント側: `SUPABASE_ANON_KEY`
   - Webhookは常にサーバー側

4. **ドキュメントの整備**
   - Supabase のキーの使い分けを文書化
   - RLS の仕組みを理解する

---

## まとめ

- **問題:** `line-webhook.js` が `SUPABASE_ANON_KEY` を使用していた
- **影響:** 友達追加しても代理店がアクティブにならず、ログインが失敗する
- **修正:** `SUPABASE_SERVICE_ROLE_KEY` に変更
- **結果:** 正常に代理店がアクティブ化され、ログインが成功するようになる

**これが「LINE Login → パスワード間違い」エラーの根本原因でした。**

---

**最終更新:** 2025-10-19 16:20
**修正者:** Claude Code
