# ✅ ログイン準備完了！

## 🚀 最後のステップ

### 1. Netlifyで再デプロイ

環境変数を追加/変更した後は、**必ず再デプロイが必要**です：

1. Netlifyダッシュボードで **Deploys** タブを開く
2. **Trigger deploy** をクリック
3. **Clear cache and deploy site** を選択
4. デプロイが完了するまで待つ（約2-3分）

### 2. ログインテスト

デプロイ完了後、以下でログイン：

#### 🔐 ログイン情報
- **URL**: `https://taskmateai.net/agency/`
- **メール**: `account1@test-agency.com`
- **パスワード**: `Test1234!`

### 3. 期待される動作

1. ログイン画面が表示される
2. 上記の認証情報を入力
3. 「ログイン」ボタンをクリック
4. 成功すると代理店ダッシュボードが表示される
   - トラッキングリンク作成
   - 統計表示
   - 手数料管理
   など

## 🔍 トラブルシューティング

### もしまだログインできない場合

#### Netlify Functionsのログを確認：
1. Netlifyダッシュボード → **Functions**
2. **agency-auth** をクリック
3. **View logs** でリアルタイムログを確認

#### 確認すべき環境変数（すべて設定済みか）：
```
✅ JWT_SECRET=2smQhpzKabdyzWXzObUzMss+dpH7THybGxhqYRP1W3o=
✅ SUPABASE_URL=https://tshqyqklixwfzkkqhlix.supabase.co
✅ SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📊 ログインが成功したら

代理店ダッシュボードで以下が可能になります：

1. **トラッキングリンク作成**
   - キャンペーン名を入力
   - LINE友達追加URL: `https://lin.ee/4NLfSqH`
   - リンクを作成 → `https://taskmateai.net/t/ABC123` のような短縮URLを取得

2. **統計確認**
   - クリック数
   - コンバージョン率
   - 手数料計算

3. **他のテストアカウント**
   同じパスワード（`Test1234!`）で他のアカウントも更新可能：
   ```sql
   UPDATE agency_users
   SET password_hash = '$2a$10$0gq4d6FAa0rbw/gSI.ZeAOfYP3uIGBkSRUGVplb5cmV5Wp5jwsCBu'
   WHERE email LIKE 'account%@test-agency.com';
   ```

## 🎉 成功！

再デプロイ後、ログインできるようになります！