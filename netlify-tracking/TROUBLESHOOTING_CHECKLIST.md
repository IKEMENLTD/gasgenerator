# 🔧 トラブルシューティングチェックリスト

**エラー**: "Error creating tracking link: undefined"
**サイト**: https://test-taskmate.netlify.app

---

## ✅ チェックリスト

### 1. LINE_OFFICIAL_URL を Netlify に追加

**現在の状態**: ❌ 未設定（不足している環境変数）

**手順**:
1. Netlify Dashboard → **test-taskmate** → **Site settings** → **Environment variables**
2. **Add a variable** をクリック
3. 以下を入力:
   ```
   Key: LINE_OFFICIAL_URL
   Value: https://line.me/R/ti/p/@taskmate
   ```
   ※ `@taskmate` は実際のLINE公式アカウントIDに置き換えてください
4. **Save** をクリック
5. 自動で再デプロイが始まります（約1-2分）

---

### 2. Supabase データベーステーブルを確認・作成

**手順**:
1. https://supabase.com/ にログイン
2. **taskmate-tracking** プロジェクトを開く
3. **Table Editor** をクリック
4. 以下のテーブルが存在するか確認:
   - ✅ `agencies` （代理店マスター）
   - ✅ `agency_users` （代理店ユーザー）
   - ✅ `agency_tracking_links` （トラッキングリンク）
   - ✅ `agency_tracking_visits` （訪問記録）
   - ✅ `agency_conversions` （コンバージョン記録）
   - ✅ `agency_commissions` （手数料管理）

**テーブルが存在しない場合**:
1. **SQL Editor** をクリック
2. **New query** を作成
3. `database/schema.sql` の内容を全てコピー&ペースト
4. **Run** をクリックして実行

---

### 3. テストアカウントのパスワードを設定

**手順**:
1. Supabase Dashboard → **SQL Editor**
2. **New query** を作成
3. `database/update_passwords.sql` の内容を全てコピー&ペースト
4. **Run** をクリックして実行

**これで以下のアカウントが使えるようになります**:
```
account1@test-agency.com / Kx9mP#2nQ@7z
account2@test-agency.com / Jy3$Rt8Lw&5v
account3@test-agency.com / Nm6!Fq4Xp*9s
account4@test-agency.com / Tz2@Hk7Yw#3b
account5@test-agency.com / Gv8&Cd5Mx!4n
account6@test-agency.com / Pq3#Ws9Rb@6j
account7@test-agency.com / Fx7!Nt2Ky&8m
account8@test-agency.com / Lz4@Jp6Qw#5c
account9@test-agency.com / Dv9&Hs3Tm!7x
account10@test-agency.com / Bw5#Yr8Kn@2p
```

---

### 4. Netlify Functions のエラーログを確認

**手順**:
1. Netlify Dashboard → **test-taskmate**
2. **Functions** タブをクリック
3. **create-tracking-link** をクリック
4. **Logs** を確認

**確認すべきエラー**:
- ❌ `Error: connect ETIMEDOUT` → Supabase接続エラー（環境変数を確認）
- ❌ `relation "agency_tracking_links" does not exist` → テーブルが作成されていない
- ❌ `Cannot read property 'LINE_OFFICIAL_URL' of undefined` → 環境変数が設定されていない
- ✅ `200 OK` → 正常動作

---

### 5. 動作確認テスト

#### ① 管理者ログイン
**URL**: https://test-taskmate.netlify.app/admin/

**ログイン情報**:
- ユーザー名: `admin`
- パスワード: `TaskMate2024Admin!`

**確認事項**:
- ✅ ログインできる
- ✅ 「新規トラッキングリンク作成」フォームが表示される
- ✅ リンク作成時にエラーが出ない

---

#### ② 代理店ログイン
**URL**: https://test-taskmate.netlify.app/agency/

**ログイン情報**:
- メールアドレス: `account1@test-agency.com`
- パスワード: `Kx9mP#2nQ@7z`

**確認事項**:
- ✅ ログインできる
- ✅ ダッシュボードが表示される
- ✅ 「新規リンク作成」ができる
- ✅ 作成したリンクが一覧に表示される

---

#### ③ トラッキングリンクのテスト
1. 代理店ダッシュボードで新規リンクを作成
2. 生成されたURLをコピー（例: `https://test-taskmate.netlify.app/t/abc123`）
3. ブラウザで開く
4. LINE公式アカウントにリダイレクトされることを確認
5. ダッシュボードで「訪問数」が1増えることを確認

---

## 🚨 よくあるエラーと解決方法

### エラー: "Error creating tracking link: undefined"

**原因1**: `LINE_OFFICIAL_URL` が設定されていない
**解決策**: チェックリスト「1. LINE_OFFICIAL_URL を Netlify に追加」を実行

**原因2**: Supabase テーブルが作成されていない
**解決策**: チェックリスト「2. Supabase データベーステーブルを確認・作成」を実行

**原因3**: 環境変数が反映されていない
**解決策**: Netlify Dashboard → Deploys → **Trigger deploy** → **Deploy site**

---

### エラー: "メールアドレスまたはパスワードが間違っています"

**原因**: テストアカウントのパスワードが設定されていない
**解決策**: チェックリスト「3. テストアカウントのパスワードを設定」を実行

---

### エラー: "このアカウントは承認待ちです"

**原因**: 代理店のステータスが `pending` のまま
**解決策**:
1. 管理者ページ (https://test-taskmate.netlify.app/admin/) にログイン
2. 「代理店管理」タブを開く
3. 該当代理店の「承認」ボタンをクリック

---

### エラー: "connect ETIMEDOUT" (Supabase接続エラー)

**原因**: Supabase環境変数が間違っている
**解決策**:
1. Supabase Dashboard → **Settings** → **API** を開く
2. 以下を確認:
   - `SUPABASE_URL`: Project URL
   - `SUPABASE_ANON_KEY`: anon public key
   - `SUPABASE_SERVICE_ROLE_KEY`: service_role key
3. Netlify の環境変数と一致しているか確認
4. 修正した場合は再デプロイ

---

## 📝 完了後の最終確認

- ✅ 管理者ページにログインできる
- ✅ 代理店ページにログインできる
- ✅ トラッキングリンクを作成できる
- ✅ リンクをクリックするとLINE公式アカウントにリダイレクトされる
- ✅ 訪問数がカウントされる
- ✅ Netlify Functions ログにエラーがない

**全てチェックが入ったら完了です！**
