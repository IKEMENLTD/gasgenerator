# Webhook設定確認チェックリスト

## 🔍 現状分析結果

### ✅ 正常に動作している機能
- トラッキングリンク作成: OK
- 訪問記録: OK (11訪問記録済み)
- ダッシュボード表示: OK

### ❌ 動作していない機能
- コンバージョン記録: 0件 ← **これが問題**
- 課金情報表示: 空配列 ← **コンバージョンがないため正常**

---

## 📋 Webhook設定確認手順

### 1. LINE Webhook設定確認

#### 1-1. LINE Developers Consoleにアクセス
1. https://developers.line.biz/console/ にログイン
2. 該当のプロバイダーを選択
3. Messaging APIチャンネルを選択

#### 1-2. Webhook URLを確認
**Messaging API設定タブ**で以下を確認:

```
✅ Webhook URL: https://taskmateai.net/.netlify/functions/line-webhook
✅ Use webhook: ONになっているか
✅ Webhook redelivery: ONになっているか（推奨）
```

#### 1-3. Webhookをテスト
**Messaging API設定タブ**で「Verify」ボタンをクリック:

```
✅ Success と表示されるか
❌ Error が表示される場合は設定が間違っている
```

#### 1-4. Webhookイベントを確認
以下のイベントが有効になっているか:

```
✅ Message events: ON
✅ Follow events: ON
✅ Unfollow events: ON
```

---

### 2. Stripe Webhook設定確認

#### 2-1. Stripe Dashboardにアクセス
1. https://dashboard.stripe.com/ にログイン
2. Developers → Webhooks を選択

#### 2-2. Webhook Endpointを確認
以下のWebhook URLが登録されているか:

```
URL: https://taskmateai.net/.netlify/functions/stripe-webhook
Status: Enabled
```

#### 2-3. イベントタイプを確認
以下のイベントが選択されているか:

```
✅ payment_intent.succeeded
✅ checkout.session.completed
✅ customer.created
✅ invoice.payment_succeeded
```

#### 2-4. Signing secretを確認
Webhook signing secretが環境変数に設定されているか:

```
Netlify Dashboard → Site settings → Environment variables
STRIPE_WEBHOOK_SECRET = whsec_XXXXXXXXX
```

---

### 3. 実際にコンバージョンをテスト

#### 3-1. LINE友達追加テスト

**手順**:
1. トラッキングリンクをコピー（例: https://taskmateai.net/t/8f5yoytw84zp）
2. ブラウザの**シークレットモード**で開く
3. LINE友達追加ページに遷移することを確認
4. **「追加」ボタンをクリック**
5. LINEアプリで友達追加を完了

**期待される結果**:
```sql
-- Supabaseで確認
SELECT * FROM agency_conversions
WHERE conversion_type = 'line_friend'
ORDER BY created_at DESC LIMIT 5;

-- 結果が1件以上あればOK
```

**デバッグ**:
- Netlify Function Logs → line-webhook を確認
- `=== FOLLOW EVENT 受信 ===` のログがあるか確認

#### 3-2. Stripe決済テスト

**前提条件**:
- Stripeのテストモードで決済を実行
- metadataに以下を含める:
  - `tracking_code`: トラッキングコード
  - `agency_id`: 代理店ID
  - `user_id`: ユーザーID（オプション）

**手順**:
1. TaskMate AIで課金を実行（テストモード）
2. Stripe Dashboardで決済を確認
3. Webhookログを確認

**期待される結果**:
```sql
-- Supabaseで確認
SELECT * FROM agency_conversions
WHERE conversion_type = 'stripe_payment'
ORDER BY created_at DESC LIMIT 5;

-- 結果が1件以上あればOK
```

**デバッグ**:
- Stripe Dashboard → Webhooks → エンドポイントを選択 → Recent deliveries
- `stripe-webhook` のログを確認

---

### 4. Webhookログの確認方法

#### 4-1. Netlify Function Logsで確認

**LINE Webhook**:
```
Netlify Dashboard → Functions → line-webhook → Logs

期待されるログ:
=== FOLLOW EVENT 受信 ===
LINE User ID: UXXXXXXXXX
✅ 代理店登録の友達追加を検知: XXX
✅ 代理店をアクティブ化しました
✅ ユーザーをアクティブ化しました
```

**Stripe Webhook**:
```
Netlify Dashboard → Functions → stripe-webhook → Logs

期待されるログ:
Processing successful payment: pi_XXXXXXXXX
Linked LINE user UXXXXXXXXX to visit XXX
LINE friend conversion recorded for agency XXX
```

#### 4-2. Supabaseでログを直接確認

```sql
-- 最新のコンバージョンを確認
SELECT
    ac.*,
    atl.name as link_name,
    a.name as agency_name
FROM agency_conversions ac
LEFT JOIN agency_tracking_links atl ON ac.tracking_link_id = atl.id
LEFT JOIN agencies a ON ac.agency_id = a.id
ORDER BY ac.created_at DESC
LIMIT 10;

-- もし0件なら、Webhookが動作していない
```

---

## 🚨 問題が見つかった場合の対処

### パターン1: LINE Webhook URLが間違っている

**症状**:
- LINE友達追加してもコンバージョンが記録されない
- Netlify Logsに何も出ない

**対処**:
```
LINE Developers Console → Messaging API設定
Webhook URL を確認:
https://taskmateai.net/.netlify/functions/line-webhook

末尾の /line-webhook が正しいか確認
```

### パターン2: Stripe Webhook Secretが間違っている

**症状**:
- 決済は成功するがコンバージョンが記録されない
- Stripe側で "Webhook signature verification failed" エラー

**対処**:
```
1. Stripe Dashboard → Webhooks → エンドポイントを選択
2. "Signing secret" をコピー
3. Netlify → Environment variables → STRIPE_WEBHOOK_SECRET を更新
4. Netlifyを再デプロイ
```

### パターン3: metadataが設定されていない

**症状**:
- Stripe決済は成功
- Webhookは受信
- しかしコンバージョンが記録されない
- ログに "No agency attribution found for payment"

**対処**:
```javascript
// TaskMate AIの決済処理で以下を追加:
stripe.paymentIntents.create({
    amount: 980,
    currency: 'jpy',
    metadata: {
        tracking_code: 'トラッキングコード',
        agency_id: '代理店ID',
        user_id: 'ユーザーID',
        line_user_id: 'LINE User ID'
    }
});
```

---

## ✅ 正常動作の確認

以下がすべてYESになればシステムは正常:

- [ ] トラッキングリンクから訪問すると `agency_tracking_visits` にレコードが追加される
- [ ] LINE友達追加すると `agency_conversions` に `line_friend` レコードが追加される
- [ ] Stripe決済すると `agency_conversions` に `stripe_payment` レコードが追加される
- [ ] ダッシュボードの課金状況タブに課金ユーザーが表示される

---

## 📞 サポート情報

### Netlify Function Logsの見方
```
Netlify Dashboard → Functions → 関数名 → Logs
リアルタイムでログが流れます
```

### Stripe Webhook Logsの見方
```
Stripe Dashboard → Developers → Webhooks
→ エンドポイントを選択 → Recent deliveries
```

### LINE Webhook Logsの見方
```
残念ながらLINE側にログはありません
Netlify Function Logsを確認してください
```

---

**最終更新**: 2025年10月20日
