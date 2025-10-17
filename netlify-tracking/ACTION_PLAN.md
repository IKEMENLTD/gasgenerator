# 🎯 即実行アクションプラン

**現在のエラー**: "Error creating tracking link: undefined"
**目標**: https://test-taskmate.netlify.app で完全に動作させる

---

## 📍 現状分析

### ✅ 設定済み（確認済み）
- ADMIN_PASSWORD ✓
- ADMIN_USERNAME ✓
- APP_URL ✓
- JWT_SECRET ✓
- LINE_CHANNEL_ACCESS_TOKEN ✓
- LINE_CHANNEL_SECRET ✓
- SUPABASE_URL ✓
- SUPABASE_ANON_KEY ✓
- SUPABASE_SERVICE_ROLE_KEY ✓

### ❌ 不足している設定
- **LINE_OFFICIAL_URL** ← これが原因でエラーが発生

### ❓ 確認が必要
- Supabaseのテーブルが作成されているか
- テストアカウントのパスワードが設定されているか

---

## 🚀 実行手順（優先順位順）

### ステップ1: LINE_OFFICIAL_URL を追加（最優先）

**所要時間**: 2分

1. Netlify Dashboard を開く → https://app.netlify.com/
2. **test-taskmate** サイトをクリック
3. **Site settings** → **Environment variables** をクリック
4. **Add a variable** をクリック
5. 以下を入力:
   ```
   Key: LINE_OFFICIAL_URL
   Value: https://line.me/R/ti/p/@taskmate
   ```
   ※ `@taskmate` の部分を実際のLINE IDに変更してください
6. **Save** をクリック
7. 自動で再デプロイが開始されます（約1-2分待つ）

**これだけで "undefined" エラーは解消されるはずです！**

---

### ステップ2: Supabaseのテーブルを確認（5分）

**手順**:
1. https://supabase.com/ を開く
2. **taskmate-tracking** プロジェクトをクリック
3. **Table Editor** をクリック
4. 左サイドバーで以下のテーブルがあるか確認:
   - `agencies`
   - `agency_users`
   - `agency_tracking_links`
   - `agency_tracking_visits`
   - `agency_conversions`
   - `agency_commissions`

**もしテーブルが存在しない場合**:
1. **SQL Editor** をクリック
2. **New query** を作成
3. ファイル `database/schema.sql` を開く
4. 全ての内容をコピー
5. Supabase SQL Editorにペースト
6. **Run** をクリック
7. "Success" が表示されることを確認

---

### ステップ3: テストアカウントを有効化（2分）

**手順**:
1. Supabase Dashboard → **SQL Editor**
2. **New query** を作成
3. ファイル `database/update_passwords.sql` を開く
4. 全ての内容をコピー
5. Supabase SQL Editorにペースト
6. **Run** をクリック

**確認**:
以下のSQLを実行して、10件のアカウントが表示されることを確認:
```sql
SELECT email, name, LEFT(password_hash, 7) as hash_prefix
FROM agency_users
WHERE email LIKE '%test-agency.com'
ORDER BY email;
```

---

### ステップ4: 動作確認テスト（5分）

#### ① 管理者ページのテスト
1. https://test-taskmate.netlify.app/admin/ を開く
2. ログイン:
   - ユーザー名: `admin`
   - パスワード: `TaskMate2024Admin!`
3. 「新規トラッキングリンク作成」セクションを確認
4. テストリンクを作成:
   - キャンペーン名: `テスト001`
   - UTM Source: `test`
   - UTM Medium: `test`
   - UTM Campaign: `test`
5. **「作成」ボタンをクリック**
6. ✅ エラーが出ず、リンクが表示されることを確認

#### ② 代理店ページのテスト
1. https://test-taskmate.netlify.app/agency/ を開く
2. ログイン:
   - メールアドレス: `account1@test-agency.com`
   - パスワード: `Kx9mP#2nQ@7z`
3. ダッシュボードが表示されることを確認
4. 「新規リンク作成」でテストリンクを作成
5. 作成したリンクをコピー
6. 新しいタブで開く
7. ✅ LINE公式アカウントにリダイレクトされることを確認

---

## 🔍 トラブルシューティング

### もしまだ "undefined" エラーが出る場合

1. **Netlify Functions ログを確認**:
   - Netlify Dashboard → Functions → create-tracking-link → Logs
   - 具体的なエラーメッセージを確認

2. **環境変数が反映されているか確認**:
   - Netlify Dashboard → Deploys → 最新のデプロイをクリック
   - Deploy log を確認
   - "Environment variables" セクションで `LINE_OFFICIAL_URL` があるか確認

3. **手動で再デプロイ**:
   - Netlify Dashboard → Deploys
   - **Trigger deploy** → **Deploy site** をクリック

4. **Supabase接続を確認**:
   ```sql
   -- Supabase SQL Editorで実行
   SELECT 'Connection OK' AS status;
   ```

---

## 📊 セットアップ状況を確認するSQL

Supabase SQL Editorで以下を実行すると、セットアップ状況が一目で分かります:

```sql
-- ファイル database/verify_setup.sql の内容を実行
```

---

## ✅ 完了チェックリスト

- [ ] LINE_OFFICIAL_URL を Netlify に追加した
- [ ] Netlify が自動再デプロイ完了した（約1-2分）
- [ ] Supabaseに6個のテーブルが存在する
- [ ] テストアカウント10件が作成されている
- [ ] 管理者ページでログインできる
- [ ] 管理者ページでトラッキングリンクを作成できる（エラーなし）
- [ ] 代理店ページでログインできる
- [ ] 代理店ページでトラッキングリンクを作成できる
- [ ] 作成したリンクをクリックするとLINE公式アカウントに飛ぶ

**全てチェックが入ったら完了です！🎉**

---

## 📞 サポート情報

### 詳細ガイド
- `QUICK_SETUP_GUIDE.md` - ゼロから始める完全セットアップガイド
- `TROUBLESHOOTING_CHECKLIST.md` - 詳細なトラブルシューティング
- `NETLIFY_ENV_VARS.md` - 環境変数の詳細説明

### テストアカウント一覧
- `NETLIFY_ENV_SETUP.txt` - テストアカウント10件のメール・パスワード

### データベース
- `database/schema.sql` - テーブル作成SQL
- `database/update_passwords.sql` - テストアカウントのパスワード設定
- `database/verify_setup.sql` - セットアップ状況確認SQL

---

**次のステップ**: まず **LINE_OFFICIAL_URL** を Netlify に追加してください。これだけで大部分の問題が解決します！
