# 📖 完全ステップバイステップガイド

## 1️⃣ Netlify環境変数の設定方法

### A. Netlifyにログイン
1. https://app.netlify.com/ にアクセス
2. あなたのアカウントでログイン
3. サイト一覧から `test-taskmate` をクリック

### B. 環境変数を追加
1. 上部メニューから `Site configuration` をクリック
2. 左サイドバーから `Environment variables` をクリック
3. `Add a variable` ボタンをクリック
4. 以下を1つずつ追加：

#### 必須変数①: SUPABASE_URL
```
Key: SUPABASE_URL
Value: （Supabaseから取得 - 手順は下記）
Scopes: All (Production, Preview, Builds, Functions)
```

#### 必須変数②: SUPABASE_SERVICE_ROLE_KEY
```
Key: SUPABASE_SERVICE_ROLE_KEY
Value: （Supabaseから取得 - 手順は下記）
Scopes: All
```

#### 必須変数③: JWT_SECRET
```
Key: JWT_SECRET
Value: 2smQhpzKabdyzWXzObUzMss+dpH7THybGxhqYRP1W3o=
Scopes: All
```

#### 必須変数④: APP_URL
```
Key: APP_URL
Value: https://test-taskmate.netlify.app
Scopes: All
```

---

## 2️⃣ Supabaseから必要な値を取得

### A. Supabaseにログイン
1. https://supabase.com/dashboard にアクセス
2. あなたのプロジェクトをクリック

### B. SUPABASE_URLを取得
1. 左サイドバーの `Project Settings`（歯車アイコン）をクリック
2. `API` セクションをクリック
3. `Project URL` の値をコピー
   ```
   例: https://xyzxyzxyz.supabase.co
   ```

### C. SUPABASE_SERVICE_ROLE_KEYを取得
1. 同じ `API` セクション内
2. `Project API keys` の項目を探す
3. `service_role` の行の `Reveal` をクリック
4. 表示された長い文字列をコピー
   ```
   例: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（とても長い文字列）
   ```

⚠️ **重要**: `anon public` ではなく `service_role` を使用してください！

---

## 3️⃣ Netlifyで環境変数を保存

1. 各環境変数を入力したら `Create variable` をクリック
2. 4つすべて追加完了したら確認：
   - SUPABASE_URL ✓
   - SUPABASE_SERVICE_ROLE_KEY ✓
   - JWT_SECRET ✓
   - APP_URL ✓

---

## 4️⃣ サイトを再デプロイ

### 方法1: Netlify管理画面から
1. 上部メニューの `Deploys` をクリック
2. `Trigger deploy` ボタンをクリック
3. `Clear cache and deploy site` を選択
4. 2-3分待つ

### 方法2: 自動で再デプロイ
環境変数を追加すると自動的に再デプロイが始まる場合があります。
`Deploys` タブで進行状況を確認してください。

---

## 5️⃣ 動作確認

### A. 環境変数の確認
```
https://test-taskmate.netlify.app/.netlify/functions/test-env
```

このURLにアクセスして以下のような結果が表示されればOK：
```json
{
  "status": {
    "healthy": true,
    "message": "✅ 必須環境変数はすべて設定されています"
  }
}
```

### B. 接続テスト
```
https://test-taskmate.netlify.app/test-connection.html
```

### C. 登録テスト
```
https://test-taskmate.netlify.app/test-registration.html
```

---

## 6️⃣ パスワードリセットメールについて

### 現在の設定（メール送信なし）
1. パスワードリセットをリクエスト
2. Netlifyで確認：
   - `Functions` タブをクリック
   - `password-reset-request` をクリック
   - `View logs` をクリック
   - リセットURLがログに表示される

### メール送信を有効にする場合（オプション）

#### SendGrid設定手順
1. https://sendgrid.com でアカウント作成（無料）
2. `Settings` → `API Keys` → `Create API Key`
3. Netlifyに環境変数追加：
   ```
   Key: SENDGRID_API_KEY
   Value: SG.xxxxx...（SendGridのAPIキー）

   Key: EMAIL_FROM
   Value: noreply@test-taskmate.netlify.app
   ```

---

## 7️⃣ トラブルシューティング

### 「500エラー」が出る場合
→ 環境変数が正しく設定されているか確認

### 「401 Unauthorized」が出る場合
→ JWT_SECRETが設定されているか確認

### ログインできない場合
→ データベースにユーザーが存在するか確認

### Supabaseで確認するSQL
```sql
-- 代理店の確認
SELECT * FROM agencies ORDER BY created_at DESC;

-- ユーザーの確認
SELECT * FROM agency_users ORDER BY created_at DESC;

-- パスワードリセットトークンの確認
SELECT * FROM password_reset_tokens ORDER BY created_at DESC;
```

---

## 📞 サポートが必要な場合

どのステップでも詰まったら、以下を教えてください：
1. どのステップまで完了したか
2. エラーメッセージ（あれば）
3. スクリーンショット（可能なら）

必ず解決できます！