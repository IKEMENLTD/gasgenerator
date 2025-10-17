# 🚀 Netlifyデプロイガイド

## ❌ 現在の問題

トラッキングリンクが404エラーになる原因:
- **プロジェクトがNetlifyサイトにリンクされていない**
- GitHubにプッシュしただけでは自動デプロイされない
- `.netlify/state.json` が存在しない

## ✅ 解決方法

### オプション 1: 既存のNetlifyサイトにリンク（推奨）

既にNetlifyサイトがある場合:

```bash
cd /mnt/c/Users/ooxmi/Downloads/gas-generator/netlify-tracking

# サイトにリンク
netlify link
```

プロンプトが表示されたら:
1. **"Use current git remote origin"** を選択
2. または **"Choose from a list of your sites"** でサイトを選択

### オプション 2: 新しいNetlifyサイトを作成

```bash
cd /mnt/c/Users/ooxmi/Downloads/gas-generator/netlify-tracking

# 新しいサイトを作成してデプロイ
netlify init

# または手動デプロイ
netlify deploy --prod
```

### オプション 3: Netlify Dashboard経由（最も簡単）

1. https://app.netlify.com/ にログイン
2. **"Add new site"** → **"Import an existing project"**
3. **GitHub** を選択
4. **IKEMENLTD/gasgenerator** リポジトリを選択
5. Build設定:
   - **Base directory:** `netlify-tracking`
   - **Build command:** (空欄)
   - **Publish directory:** `.` (ドット)
   - **Functions directory:** `netlify/functions`

6. **環境変数** を設定:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - `LINE_OFFICIAL_URL`
   - その他必要な環境変数

7. **Deploy site** をクリック

## 📋 デプロイ後の確認

### 1. Netlify Functions が正しくデプロイされているか確認

```bash
netlify functions:list
```

以下が表示されるはず:
```
track-redirect
agency-auth
agency-create-link
agency-stats
agency-links
...
```

### 2. 環境変数が設定されているか確認

Netlify Dashboard:
1. Site settings → Environment variables
2. 以下が設定されているか確認:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - `LINE_OFFICIAL_URL`

### 3. トラッキングリンクをテスト

1. ダッシュボードで新しいトラッキングリンクを作成
2. 作成されたリンクをクリック
3. LINEページにリダイレクトされることを確認

### 4. Netlify Function ログを確認

```bash
netlify functions:log track-redirect
```

または Netlify Dashboard:
- Functions → track-redirect → Logs

## 🔍 トラブルシューティング

### 問題: まだ404エラーが出る

**原因1: Base directoryが間違っている**

Netlify Dashboard → Site settings → Build & deploy → Build settings
- **Base directory:** `netlify-tracking` に設定

**原因2: Functions directoryが検出されていない**

`netlify.toml` を確認:
```toml
[build]
  functions = "netlify/functions"
```

**原因3: 環境変数が設定されていない**

Netlify Dashboard → Site settings → Environment variables
- すべての必要な環境変数を追加

**原因4: ビルドに失敗している**

Netlify Dashboard → Deploys → 最新のデプロイ
- ログを確認してエラーを特定

## 🎯 現在のアクセスURL

どのURLでアクセスしていますか?
- [ ] `https://________.netlify.app`
- [ ] カスタムドメイン: `https://________`

URLを確認したら、そのサイトにプロジェクトをリンクしてください。

---

**次のステップ:**
1. 現在アクセスしているURLを確認
2. そのNetlifyサイトにプロジェクトをリンク
3. デプロイを確認
4. トラッキングリンクを再テスト
