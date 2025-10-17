# 🔍 トラッキングリンク 404 エラー デバッグガイド

## 🎯 問題の概要

トラッキングリンク（`/t/[tracking_code]`）を開くと、Netlifyの404エラーページが表示される問題が発生しています。

## 📊 実装した診断機能

### 1. 詳細ログの追加

以下のファイルに詳細なログを追加しました：

#### `track-redirect.js` - トラッキングリダイレクト関数
- 🔗 Function呼び出しログ
- 📍 リクエストパスとメソッド
- 🔍 トラッキングコード抽出ログ
- 🔎 データベース検索ログ
- ✅/❌ 各ステップの成功/失敗ログ
- 🚀 リダイレクト実行ログ
- 📊 訪問カウント更新ログ

#### `agency-create-link.js` - リンク作成関数
- ✅ トラッキングコード生成ログ
- 🔗 リンク作成処理ログ
- 📊 作成されたリンクの詳細情報
- ❌ エラー詳細ログ

### 2. デバッグツール

#### `test-redirect.html` - インタラクティブなテストページ
アクセス: `https://your-site.netlify.app/test-redirect.html`

機能：
- トラッキングコードのテスト
- リダイレクトの動作確認
- レスポンスの詳細表示
- リアルタイムログ表示

## 🔎 考えられる原因と診断方法

### 原因 1: トラッキングリンクがデータベースに存在しない

**症状:**
- 404エラー
- ログに「Tracking link not found」メッセージ

**診断方法:**
1. Supabase Dashboardにログイン
2. Table Editor → `agency_tracking_links` を開く
3. 作成したトラッキングコードを検索
4. レコードが存在するか確認

**解決方法:**
- リンクを再作成
- `is_active` カラムが `true` になっているか確認

### 原因 2: Netlify Function が正しくデプロイされていない

**症状:**
- 404エラー
- Netlify のデフォルト404ページが表示される

**診断方法:**
```bash
# Netlify CLIで確認
netlify functions:list

# 出力に track-redirect が含まれているか確認
```

**解決方法:**
```bash
# 再デプロイ
git add .
git commit -m "Update track-redirect function with logging"
git push origin main
```

### 原因 3: 環境変数が設定されていない

**症状:**
- 500エラー
- ログに「Missing Supabase environment variables」

**診断方法:**
Netlify Dashboard:
1. Site settings → Environment variables
2. 以下の変数が設定されているか確認:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`

**解決方法:**
- 環境変数を追加/更新
- サイトを再デプロイ

### 原因 4: netlify.toml のリダイレクト設定の問題

**診断方法:**
`netlify.toml` を確認：

```toml
[[redirects]]
  from = "/t/:tracking_code"
  to = "/.netlify/functions/track-redirect/:tracking_code"
  status = 200
```

**解決方法:**
- 設定が正しいことを確認
- `status = 200` (プロキシ)であることを確認

### 原因 5: Function のコードエラー

**診断方法:**
```bash
# ローカルでテスト
netlify dev

# ブラウザで http://localhost:8888/t/test-code にアクセス
```

Netlify Dashboard でログを確認:
1. Functions → track-redirect
2. Logs タブを開く
3. エラーメッセージを確認

## 🛠️ デバッグ手順（推奨）

### ステップ 1: テストページでテスト

1. `https://your-site.netlify.app/test-redirect.html` を開く
2. 作成したトラッキングコードを入力
3. 「テスト実行」をクリック
4. 結果とログを確認

### ステップ 2: Netlify Function ログを確認

```bash
# Netlify CLI を使用
netlify functions:log track-redirect

# または Netlify Dashboard で確認
# Functions → track-redirect → Logs
```

### ステップ 3: データベースを確認

1. Supabase Dashboard にログイン
2. Table Editor → `agency_tracking_links`
3. 作成したリンクを検索
4. 以下を確認:
   - `tracking_code` が正しいか
   - `is_active` が `true` か
   - `line_friend_url` または `destination_url` が設定されているか

### ステップ 4: ローカルでテスト

```bash
# プロジェクトディレクトリで
cd /mnt/c/Users/ooxmi/Downloads/gas-generator/netlify-tracking

# Netlify Dev を起動
netlify dev

# 別のターミナルでテスト
curl -v http://localhost:8888/t/your-tracking-code
```

## 📋 チェックリスト

デプロイ前に確認:

- [ ] `netlify.toml` にリダイレクト設定がある
- [ ] 環境変数がすべて設定されている
- [ ] Supabase テーブル `agency_tracking_links` が存在する
- [ ] Function がデプロイされている（`netlify functions:list`）
- [ ] ローカルでテストして動作している（`netlify dev`）
- [ ] テストページでトラッキングコードが機能している

## 🔧 トラブルシューティング コマンド

```bash
# Function が存在するか確認
netlify functions:list

# Function のログをリアルタイムで確認
netlify functions:log track-redirect --follow

# ローカルでデバッグ実行
netlify dev

# デプロイ状態を確認
netlify status

# Function を手動でテスト
curl -v https://your-site.netlify.app/t/test-code
```

## 📞 サポート情報

### ログの見方

**成功時:**
```
🔗 Track-redirect function called
📍 Full path: /t/abc123xyz789
🔍 Extracted tracking code: abc123xyz789
✅ Tracking link found: {...}
🚀 Redirecting to: https://line.me/...
```

**失敗時（リンクが存在しない）:**
```
🔗 Track-redirect function called
📍 Full path: /t/invalid-code
🔍 Extracted tracking code: invalid-code
⚠️ Tracking link not found: invalid-code
```

**失敗時（データベースエラー）:**
```
🔗 Track-redirect function called
📍 Full path: /t/abc123xyz789
❌ Database error when fetching tracking link: {...}
```

### よくあるエラーと解決策

| エラーメッセージ | 原因 | 解決策 |
|-----------------|------|-------|
| "Tracking code not found" | パスにトラッキングコードがない | URLを確認 |
| "Tracking link not found" | DBにリンクが存在しない | リンクを再作成 |
| "Missing Supabase environment variables" | 環境変数未設定 | Netlifyで設定 |
| "Database error" | Supabase接続エラー | 認証情報を確認 |
| Netlify 404ページ | Functionが呼ばれていない | netlify.toml確認 |

## 🎓 追加の診断情報

### NODE_ENV の確認

本番環境では、多くのログが無効化されます。
開発環境で詳細なログを確認するには:

```bash
# ローカル開発
netlify dev

# または環境変数を設定
export NODE_ENV=development
```

### 本番環境でのログ確認

```bash
# Netlify CLI でリアルタイム確認
netlify functions:log track-redirect --follow

# または Netlify Dashboard
# https://app.netlify.com/sites/your-site/functions/track-redirect
```

---

**作成日:** 2025-10-17
**バージョン:** 1.0
**関連ファイル:** track-redirect.js, agency-create-link.js, test-redirect.html
