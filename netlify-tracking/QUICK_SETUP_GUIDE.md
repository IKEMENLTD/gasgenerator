# 🚀 クイックセットアップガイド

test-taskmate.netlify.app を動かすための手順

---

## ステップ1: Supabaseプロジェクト作成

1. https://supabase.com/ にアクセス
2. 「Start your project」をクリック
3. プロジェクト名: `taskmate-tracking`
4. データベースパスワードを設定（メモしておく）
5. リージョン: **Northeast Asia (Tokyo)** を選択

---

## ステップ2: データベーステーブル作成

Supabase Dashboard → SQL Editor で以下のSQLファイルを順番に実行：

### 2-1. メインテーブル作成
```sql
-- database/schema.sql の内容を全てコピーして実行
```

### 2-2. テストアカウント作成
```sql
-- database/update_passwords.sql の内容を全てコピーして実行
```

---

## ステップ3: Netlify環境変数設定

**Netlify Dashboard** → **test-taskmate** → **Site settings** → **Environment variables**

### 最小限の設定（これだけあれば動きます）

#### Supabase接続情報
```
SUPABASE_URL = https://your-project.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**取得方法**: Supabase → Settings → API

#### JWT認証キー
```
JWT_SECRET = 任意の32文字以上のランダム文字列
```

例: `a8f3d2e9b1c4f7a6d5e8b2c9f3a1d4e7b9c2f5a8d1e4b7c9f2a5d8e1b4c7f9a2`

#### 管理者ログイン
```
ADMIN_USERNAME = admin
ADMIN_PASSWORD = TaskMate2024Admin!
```

#### LINE公式アカウント
```
LINE_CHANNEL_ACCESS_TOKEN = your-channel-access-token
LINE_CHANNEL_SECRET = your-channel-secret
LINE_OFFICIAL_URL = https://line.me/R/ti/p/@taskmate
```

**取得方法**: LINE Developers Console → Messaging API

---

## ステップ4: 再デプロイ

Netlify Dashboard → Deploys → **Trigger deploy** → **Deploy site**

環境変数を設定したら自動で再デプロイされますが、念のため手動でトリガーしてください。

---

## ステップ5: ログインテスト

### 管理者ページ
URL: https://test-taskmate.netlify.app/admin/
- ユーザー名: `admin`
- パスワード: `TaskMate2024Admin!`

### 代理店ページ
URL: https://test-taskmate.netlify.app/agency/
- メール: `account1@test-agency.com`
- パスワード: `Kx9mP#2nQ@7z`

---

## トラブルシューティング

### エラー: "Error creating tracking link: undefined"

**原因**: 環境変数が設定されていない

**解決策**:
1. Netlify環境変数を確認
2. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` が設定されているか
3. Netlifyを再デプロイ

### エラー: "メールアドレスまたはパスワードが間違っています"

**原因**: データベースにテストアカウントが存在しない

**解決策**:
1. Supabaseで `database/update_passwords.sql` を実行
2. または新規登録してから管理者ページで承認

### エラー: "このアカウントは承認待ちです"

**原因**: 代理店のステータスが `pending` のまま

**解決策**:
1. 管理者ページ (https://test-taskmate.netlify.app/admin/) にログイン
2. 「代理店管理」タブを開く
3. 該当代理店の「承認」ボタンをクリック

---

## 完了確認

✅ 管理者ページにログインできる
✅ 代理店ページにログインできる
✅ トラッキングリンクを作成できる
✅ リンクをコピーできる

これで完了です！
