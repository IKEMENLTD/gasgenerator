# 🚨 NETLIFY BASE DIRECTORY 修正手順

## 🎯 根本原因

**問題:** Netlifyが**リポジトリのルート**をデプロイしているため、`netlify-tracking/` ディレクトリ内のファイルが無視されている。

**結果:**
- ❌ `netlify-tracking/netlify.toml` が読まれない
- ❌ `netlify-tracking/netlify/functions/track-redirect.js` がデプロイされない
- ❌ トラッキングリンク (`/t/xxxxx`) が 404 エラー

---

## ✅ 修正方法（5分で完了）

### **ステップ 1: Netlify Dashboard を開く**

1. https://app.netlify.com/ にログイン
2. **gasgenerator** サイトを開く（またはトラッキングシステム用のサイト）

### **ステップ 2: Build settings を変更**

1. 左メニューから **Site settings** をクリック
2. **Build & deploy** → **Build settings** をクリック
3. **Edit settings** ボタンをクリック
4. 以下のように設定:

```
Base directory: netlify-tracking
Build command: (空欄のまま)
Publish directory: .
```

5. **Save** をクリック

### **ステップ 3: Functions directory を確認**

同じ Build settings ページで:

```
Functions directory: netlify/functions
```

これが設定されているか確認。なければ追加。

### **ステップ 4: 再デプロイ**

1. **Deploys** タブに戻る
2. **Trigger deploy** → **Clear cache and deploy site** をクリック
3. デプロイが完了するまで待つ（2-5分）

---

## 📊 デプロイ後の確認

### **1. Functions がデプロイされているか確認**

Netlify Dashboard:
- **Functions** タブを開く
- 以下が表示されるはず:
  ```
  track-redirect
  agency-auth
  agency-create-link
  agency-stats
  agency-links
  agency-billing-stats
  agency-commissions
  agency-analytics
  agency-settings
  agency-register
  agency-change-password
  agency-logout
  ```

### **2. トラッキングリンクをテスト**

1. ダッシュボードで新しいトラッキングリンクを作成
2. 作成されたリンク（例: `https://your-site.netlify.app/t/abc123xyz`）をクリック
3. **期待される動作:**
   - ✅ LINEページにリダイレクト
   - または "Tracking Link Not Found" ページ（リンクがDBに存在しない場合）

4. **404エラーが出る場合:**
   - Base directory の設定が反映されていない
   - デプロイログを確認

### **3. デプロイログを確認**

Netlify Dashboard → **Deploys** → 最新のデプロイをクリック:

**正常なログの例:**
```
1:23:45 PM: Build ready to start
1:23:47 PM: build-image version: ...
1:23:47 PM: Base directory: netlify-tracking
1:23:48 PM: Functions directory: netlify/functions
1:23:49 PM: Bundling functions...
1:23:50 PM: ✓ track-redirect
1:23:50 PM: ✓ agency-auth
1:23:50 PM: ✓ agency-create-link
...
1:23:55 PM: Site is live
```

**エラーがある場合のログ例:**
```
1:23:45 PM: Base directory: (空欄)
1:23:48 PM: Functions directory not found
```

---

## 🔍 トラブルシューティング

### **問題: Base directory を設定したのにまだ404が出る**

**原因1: キャッシュが残っている**

解決方法:
1. **Deploys** → **Trigger deploy** → **Clear cache and deploy site**

**原因2: 環境変数が設定されていない**

以下の環境変数が設定されているか確認:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `LINE_OFFICIAL_URL`

**原因3: トラッキングコードがDBに存在しない**

解決方法:
1. ダッシュボードで**新しいリンクを作成**
2. 新しいリンクでテスト

---

## 📸 スクリーンショットで確認

### **Build settings 画面**

正しい設定:
```
┌─────────────────────────────────────┐
│ Build settings                      │
├─────────────────────────────────────┤
│ Base directory                      │
│ netlify-tracking                    │ ← 重要!
├─────────────────────────────────────┤
│ Build command                       │
│ (空欄)                              │
├─────────────────────────────────────┤
│ Publish directory                   │
│ .                                   │
├─────────────────────────────────────┤
│ Functions directory                 │
│ netlify/functions                   │
└─────────────────────────────────────┘
```

---

## ✅ チェックリスト

デプロイ前に確認:

- [ ] Base directory が `netlify-tracking` に設定されている
- [ ] Functions directory が `netlify/functions` に設定されている
- [ ] 環境変数がすべて設定されている
- [ ] キャッシュをクリアしてデプロイした
- [ ] デプロイログに "Functions directory: netlify/functions" が表示されている
- [ ] Functions タブに `track-redirect` が表示されている

すべてチェックできたら、トラッキングリンクをテストしてください!

---

## 🆘 まだ問題がある場合

以下の情報を確認してください:

1. **Netlify Dashboard → Deploys → 最新のデプロイログ**
   - `Base directory:` の行をコピー
   - `Functions directory:` の行をコピー

2. **Netlify Dashboard → Functions**
   - 表示されているFunction一覧をコピー

3. **実際のトラッキングリンクURL**
   - 例: `https://your-site.netlify.app/t/abc123xyz`

4. **ブラウザのコンソールログ**
   - F12 → Console タブのエラーメッセージ

これらの情報があれば、さらに詳しく診断できます。
