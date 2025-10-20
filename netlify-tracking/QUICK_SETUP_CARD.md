# ⚡ クイックセットアップカード

**所要時間**: 30分
**目的**: コンバージョントラッキングを動作させる

---

## 🎯 重要な発見

**LINE_OFFICIAL_URL**: `https://lin.ee/FMy4xlx` を使用
(.env.localの古い値 `https://lin.ee/1wyjuRu` は無視)

---

## ✅ 実行チェックリスト

### 1️⃣ Netlify環境変数（15分）

https://app.netlify.com/ → Site settings → Environment variables

```bash
# コピペ用（全て All deploys に設定）

LINE_OFFICIAL_URL
https://lin.ee/FMy4xlx

STRIPE_WEBHOOK_SECRET
whsec_C1FXcTbkB405EFTGozR3V8fo81eejyqm

LINE_CHANNEL_SECRET
0917a4d9a8422c86990ca5123e273e7c

LINE_CHANNEL_ACCESS_TOKEN
a/iQAlWnnVy+NJtPXOhCl29mEXCvfHCdz9+ZyeEX6mUSpI2T2pEMqXtL5NwzRbXR60LqdOVkz0ZhPWzZQ5PTBC/LUQhhkA+1vShVDNs05nhVzOLJGrlRUVivQadWsu85x9RFQ8ShohkAbL+on0F59AdB04t89/1O/w1cDnyilFU=

SUPABASE_URL
https://ebtcowcgkdurqdqcjrxy.supabase.co

SUPABASE_SERVICE_ROLE_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidGNvd2Nna2R1cnFkcWNqcnh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY5MjAxNCwiZXhwIjoyMDcyMjY4MDE0fQ.RSMxrry0nrBDgvZEtc9s1hAFW_ojiiIU8YgACF48cCY

STRIPE_SECRET_KEY
sk_live_xxxxx[REDACTED]
```

### 2️⃣ Netlify再デプロイ（2分）

Netlify → Deploys → Trigger deploy → Deploy site

### 3️⃣ LINE Webhook設定（5分）

https://developers.line.biz/console/

```
Messaging API設定 → Webhook URL:
https://taskmateai.net/.netlify/functions/line-webhook

Use webhook: ON
```

**Verify ボタンをクリック → 200 OK を確認**

### 4️⃣ Stripe Webhook設定（5分）

https://dashboard.stripe.com/webhooks → Add endpoint

```
Endpoint URL:
https://taskmateai.net/.netlify/functions/stripe-webhook

Events:
☑ payment_intent.succeeded
☑ checkout.session.completed
☑ customer.created
☑ invoice.payment_succeeded
```

**Signing secret が whsec_C1FXcTbkB405EFTGozR3V8fo81eejyqm と一致することを確認**

### 5️⃣ テスト（5分）

```
1. https://taskmateai.net/t/8f5yoytw84zp にアクセス
2. LINE友達追加をクリック
3. LINEアプリが開くことを確認 ✅
```

### 6️⃣ 確認（5分）

Supabase SQL Editor:
```sql
SELECT * FROM agency_conversions
WHERE conversion_type = 'line_friend'
ORDER BY created_at DESC LIMIT 5;
```

**期待**: 1件以上のレコード

---

## 🚨 エラー対処

### LINE Verify が失敗
→ Netlify再デプロイしましたか？

### LINEアプリが開かない
→ `LINE_OFFICIAL_URL` = `https://lin.ee/FMy4xlx` を確認

### コンバージョンが0件
→ STEP 5のテストを実行しましたか？

---

## 📞 完了後

ダッシュボードをリロード:
https://taskmateai.net/agency/dashboard

「訪問」タブに新しい訪問が表示されればOK！

---

**詳細**: FINAL_ACTION_PLAN.md 参照
