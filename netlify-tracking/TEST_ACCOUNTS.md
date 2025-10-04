# 🔑 テストアカウント一覧

## 📋 代理店テストアカウント（10個）

| アカウント名 | メールアドレス | パスワード | 手数料率 | 備考 |
|------------|--------------|-----------|---------|------|
| **アカウント1** | account1@test-agency.com | `Kx9mP#2nQ@7z` | 10% | 株式会社テスト1 |
| **アカウント2** | account2@test-agency.com | `Jy3$Rt8Lw&5v` | 12% | 株式会社テスト2 |
| **アカウント3** | account3@test-agency.com | `Nm6!Fq4Xp*9s` | 15% | 株式会社テスト3 |
| **アカウント4** | account4@test-agency.com | `Tz2@Hk7Yw#3b` | 10% | 株式会社テスト4 |
| **アカウント5** | account5@test-agency.com | `Gv8&Cd5Mx!4n` | 13% | 株式会社テスト5 |
| **アカウント6** | account6@test-agency.com | `Pq3#Ws9Rb@6j` | 11% | 株式会社テスト6 |
| **アカウント7** | account7@test-agency.com | `Fx7!Nt2Ky&8m` | 14% | 株式会社テスト7 |
| **アカウント8** | account8@test-agency.com | `Lz4@Jp6Qw#5c` | 12% | 株式会社テスト8 |
| **アカウント9** | account9@test-agency.com | `Dv9&Hs3Tm!7x` | 10% | 株式会社テスト9 |
| **アカウント10** | account10@test-agency.com | `Bw5#Yr8Kn@2p` | 15% | 株式会社テスト10 |

## 🚀 セットアップ手順

### 1. パスワードのハッシュ化

```bash
# ローカルでハッシュ化スクリプトを実行
cd /mnt/c/Users/ooxmi/Downloads/gas-generator/netlify-tracking
node scripts/hash-passwords.js
```

### 2. Supabaseでアカウント作成

1. Supabaseのダッシュボードにログイン
2. SQL Editorを開く
3. 以下のファイルの内容を実行:
   - `/database/create_test_accounts.sql` - 代理店マスター作成
   - `hash-passwords.js`の出力結果 - パスワード設定

### 3. 動作確認

代理店ログインページ: `https://taskmateai.net/agency/`

上記のメールアドレスとパスワードでログインできます。

## 🔐 パスワードポリシー

すべてのパスワードは以下の条件を満たしています:
- 12文字以上
- 大文字・小文字の英字を含む
- 数字を含む
- 特殊文字（@, #, !, &, * など）を含む
- ランダムに生成された強固なパスワード

## ⚠️ セキュリティ注意事項

- これらは**テスト環境専用**のアカウントです
- 本番環境では必ず新しいパスワードを生成してください
- パスワードは定期的に変更することを推奨します
- このファイルは本番環境にコミットしないでください

## 📝 アカウント管理

### パスワードリセット（管理者用SQL）
```sql
-- 特定のアカウントのパスワードをリセット
UPDATE agency_users
SET password_hash = '新しいハッシュ値'
WHERE email = 'account1@test-agency.com';
```

### アカウント無効化
```sql
-- 特定のアカウントを無効化
UPDATE agency_users
SET is_active = false
WHERE email = 'account1@test-agency.com';
```

### アカウント削除
```sql
-- 代理店とユーザーを完全削除
DELETE FROM agencies WHERE code = 'AGENCY001';
-- ユーザーは CASCADE で自動削除されます
```

## 🎯 テストシナリオ

各アカウントで以下のテストができます:

1. **ログインテスト** - 各アカウントでログイン可能か確認
2. **リンク作成テスト** - トラッキングリンクを作成
3. **統計表示テスト** - ダッシュボードの統計が正しく表示されるか
4. **手数料計算テスト** - 各手数料率で正しく計算されるか
5. **マルチテナントテスト** - 他の代理店のデータが見えないか確認