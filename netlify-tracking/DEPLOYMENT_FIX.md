# 🚨 デプロイメント問題の修正ガイド

## 確認されたエラー

1. **500エラー** - agency-register
2. **401エラー** - agency-auth
3. **メール未送信** - password-reset

## 原因と解決方法

### 1. 環境変数の未設定

**Netlify管理画面で設定が必要：**

```
Site settings → Environment variables → Add a variable
```

必須環境変数：
```
SUPABASE_URL = https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJhbGc...（長い文字列）
JWT_SECRET = your-secret-key-here-at-least-32-characters-long
APP_URL = https://test-taskmate.netlify.app
```

### 2. データベーステーブルの確認

Supabaseで以下を確認：

```sql
-- テーブル存在確認
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('agencies', 'agency_users', 'password_reset_tokens');

-- カラム確認
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('agencies', 'agency_users');
```

### 3. メール送信の設定

#### オプション A: 開発モード（メールなし）
現在の設定のまま、Netlify Functionsのログで確認：
1. Netlify管理画面 → Functions
2. `password-reset-request` → View logs
3. リセットURLがログに表示される

#### オプション B: SendGrid設定（推奨）

1. **SendGridアカウント作成**
   - https://sendgrid.com/
   - 無料プランで月12,000通

2. **APIキー生成**
   - Settings → API Keys → Create API Key
   - Full Accessを選択

3. **Netlify環境変数追加**
   ```
   SENDGRID_API_KEY = SG.xxxxx...
   EMAIL_FROM = noreply@test-taskmate.netlify.app
   ```

4. **package.json更新**
   ```json
   "dependencies": {
     "@sendgrid/mail": "^7.7.0"
   }
   ```

### 4. 即座の対処法

#### A. ログでパスワードリセットURLを確認

1. パスワードリセットをリクエスト
2. Netlify Functions → password-reset-request → Logs
3. 以下のようなログを探す：
```
=== PASSWORD RESET LINK ===
Reset URL: https://test-taskmate.netlify.app/agency/reset-password.html?token=xxxxx
```

#### B. 手動でトークンを取得（Supabase）

```sql
-- 最新のリセットトークンを確認
SELECT
    prt.*,
    au.email,
    au.name
FROM password_reset_tokens prt
JOIN agency_users au ON prt.agency_user_id = au.id
WHERE prt.expires_at > NOW()
AND prt.used = false
ORDER BY prt.created_at DESC
LIMIT 1;
```

## デバッグ手順

### 1. 環境変数確認
```javascript
// test-env.jsとして作成してNetlify Functionsに追加
exports.handler = async (event) => {
    return {
        statusCode: 200,
        body: JSON.stringify({
            hasSupabaseUrl: !!process.env.SUPABASE_URL,
            hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            hasJwtSecret: !!process.env.JWT_SECRET,
            appUrl: process.env.APP_URL
        })
    };
};
```

### 2. デプロイ再実行
```bash
# ローカルで
npm install
netlify deploy --prod

# または Netlify管理画面で
Deploys → Trigger deploy → Clear cache and deploy site
```

## チェックリスト

- [ ] Netlify環境変数設定
- [ ] Supabaseテーブル作成
- [ ] password_reset_tokensテーブル追加
- [ ] SendGrid設定（オプション）
- [ ] デプロイ再実行

## テストURL

- 診断: https://test-taskmate.netlify.app/test-connection.html
- 登録: https://test-taskmate.netlify.app/test-registration.html
- ログイン: https://test-taskmate.netlify.app/agency/
- リセット: https://test-taskmate.netlify.app/agency/reset-password.html