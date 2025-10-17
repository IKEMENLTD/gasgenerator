# Netlify環境変数設定ガイド

Netlify Dashboard → Site settings → Environment variables → Edit variables で以下を設定してください。

## 📋 必須環境変数

### Supabase設定
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**取得方法**: Supabase Dashboard → Project Settings → API

---

### JWT認証
```
JWT_SECRET=your-secret-key-here-at-least-32-characters-long
```

**生成方法**:
```bash
# ランダムな32文字以上の文字列を生成
openssl rand -base64 32
```

---

### LINE公式アカウント
```
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token
LINE_CHANNEL_SECRET=your-line-channel-secret
LINE_OFFICIAL_URL=https://line.me/R/ti/p/@your-line-id
```

**取得方法**: LINE Developers Console → Messaging API設定

**重要**: `LINE_OFFICIAL_URL` は `@` を含めてください（例: `@taskmate`）

---

### 管理者アカウント
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=TaskMate2024Admin!
```

**重要**: デフォルトパスワードは必ず変更してください！

---

## 🔧 オプション環境変数

### Stripe決済（報酬計算用）
```
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
```

---

### アプリケーション設定
```
APP_URL=https://your-site.netlify.app
TRACKING_BASE_URL=https://your-site.netlify.app/t/
```

---

### メール通知（SendGrid）
```
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=noreply@taskmateai.net
```

---

## ✅ 設定後の確認

1. Netlify Functions Logs でエラーがないか確認
2. テストアカウントでログイン試行
3. トラッキングリンク作成をテスト

---

## 🔐 セキュリティ注意事項

- `ADMIN_PASSWORD` は必ず強力なパスワードに変更
- `JWT_SECRET` は32文字以上のランダム文字列
- `SUPABASE_SERVICE_ROLE_KEY` は絶対に公開しない
- 環境変数は Git にコミットしない
