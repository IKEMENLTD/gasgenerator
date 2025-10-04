# 🎯 最終セットアップ手順

## ✅ Netlify環境変数設定

以下の環境変数をNetlifyに設定してください：

```
JWT_SECRET=2smQhpzKabdyzWXzObUzMss+dpH7THybGxhqYRP1W3o=
```

または、より安全な別の値：
```
JWT_SECRET=kJ8Qp2Nx5Tm3Hy7Ws4Bv9Lz6Rf1Cd8Mn0Xg5Yt2Kq3Jw
```

## 📝 環境変数設定方法

1. **Netlifyダッシュボード** → **Site settings**
2. **Environment variables** → **Add a variable**
3. **Key**: `JWT_SECRET`
4. **Value**: 上記のいずれかの値を貼り付け
5. **Save**をクリック

## 🔄 再デプロイ

環境変数を設定後、再デプロイが必要です：

1. **Deploys** タブを開く
2. **Trigger deploy** → **Clear cache and deploy site**

## 👤 ログイン情報（確認済み）

Supabaseで以下のSQLを実行済みの場合：

```sql
UPDATE agency_users
SET password_hash = '$2a$10$0gq4d6FAa0rbw/gSI.ZeAOfYP3uIGBkSRUGVplb5cmV5Wp5jwsCBu'
WHERE email = 'account1@test-agency.com';
```

### ログイン情報：
- **URL**: `https://taskmateai.net/agency/`
- **Email**: `account1@test-agency.com`
- **Password**: `Test1234!`

## 🚀 動作確認

1. `https://taskmateai.net/agency/` にアクセス
2. 上記のログイン情報でログイン
3. 代理店ダッシュボードが表示される

## ⚠️ まだ動かない場合

### Netlify Functionsログを確認

1. Netlifyダッシュボード → **Functions**
2. **agency-auth** をクリック
3. **Real-time logs** でエラーを確認

### 確認すべき環境変数

```
SUPABASE_URL=https://tshqyqklixwfzkkqhlix.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（実際のキー）
JWT_SECRET=2smQhpzKabdyzWXzObUzMss+dpH7THybGxhqYRP1W3o=
```

これで動作するはずです！