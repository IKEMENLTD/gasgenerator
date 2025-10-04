# 🌐 アクセスURL一覧

## 📊 システム管理画面（オーナー用）

### URL: `https://taskmateai.net/admin/`
- **ユーザー名**: `admin`
- **パスワード**: `TaskMate2024Admin!`
- **機能**:
  - 全体の統計確認
  - トラッキングリンク作成
  - 訪問分析
  - LINEユーザー管理

---

## 🏢 代理店管理画面（営業代理店用）

### URL: `https://taskmateai.net/agency/`
- **ログイン**: メールアドレス + パスワード
- **テストアカウント**:
  - メール: `test@agency.com`
  - パスワード: `Test1234!` （要設定）
- **機能**:
  - 独自トラッキングリンク作成
  - クリック数・コンバージョン測定
  - 手数料管理
  - 振込先設定

---

## 🔗 トラッキングリンク

### URL形式: `https://taskmateai.net/t/{tracking_code}`
- **例**: `https://taskmateai.net/t/ABC123XY`
- **リダイレクト先**: `https://lin.ee/4NLfSqH`
- **機能**:
  - クリック測定
  - セッション作成
  - 代理店への紐付け

---

## 🛠️ API エンドポイント

### Webhooks
- **LINE Webhook**: `https://taskmateai.net/.netlify/functions/line-webhook`
- **Stripe Webhook**: `https://taskmateai.net/.netlify/functions/stripe-webhook`

### 管理者API
- 統計取得: `/.netlify/functions/get-tracking-stats`
- リンク作成: `/.netlify/functions/create-tracking-link`
- 認証: `/.netlify/functions/validate-admin`

### 代理店API
- 認証: `/.netlify/functions/agency-auth`
- リンク作成: `/.netlify/functions/agency-create-link`
- 統計取得: `/.netlify/functions/agency-stats`
- 手数料: `/.netlify/functions/agency-commission`

---

## 📝 ローカルテスト

```bash
# Netlify Dev でローカルテスト
cd /mnt/c/Users/ooxmi/Downloads/gas-generator/netlify-tracking
netlify dev

# アクセス
http://localhost:8888/admin/      # 管理画面
http://localhost:8888/agency/     # 代理店画面
http://localhost:8888/t/TEST001   # トラッキングテスト
```

---

## 🚀 本番環境セットアップ

1. **Netlifyデプロイ後のURL確認**
   - Netlifyダッシュボードで実際のURLを確認
   - 例: `https://taskmate-tracking.netlify.app/`

2. **カスタムドメイン設定（推奨）**
   - `tracking.taskmateai.net` などのサブドメイン
   - Netlifyでカスタムドメイン設定

3. **代理店アカウント作成**
   ```sql
   -- Supabaseで実行
   INSERT INTO agencies (code, name, contact_email, commission_rate)
   VALUES ('AGENCY001', 'サンプル代理店', 'test@agency.com', 15.00);
   ```

---

## ⚠️ 注意事項

- 代理店ページ（`/agency/`）にアクセスするには、事前にSupabaseで代理店アカウントを作成する必要があります
- 管理者ページは環境変数で認証情報を設定
- トラッキングリンクは代理店またはシステム管理者が作成後に有効になります