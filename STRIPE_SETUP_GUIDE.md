# Stripe設定完全ガイド

## 1. Stripe Webhook設定

### 手順：
1. **Stripe Dashboard にログイン**
   - https://dashboard.stripe.com
   - 本番環境（Live mode）を選択

2. **Webhookエンドポイントを追加**
   - 左メニュー → 「開発者」→「Webhook」
   - 「エンドポイントを追加」ボタンをクリック
   
3. **エンドポイントURL設定**
   ```
   エンドポイントURL: https://gasgenerator.onrender.com/api/stripe/webhook
   ```

4. **イベントを選択**
   以下のイベントにチェック：
   - ✅ `checkout.session.completed` （決済完了時）
   - ✅ `customer.subscription.created` （サブスク作成時）
   - ✅ `customer.subscription.updated` （サブスク更新時）
   - ✅ `customer.subscription.deleted` （サブスク解約時）

5. **エンドポイントを追加**
   - 「エンドポイントを追加」ボタンをクリック
   
6. **Webhook署名シークレットを取得**
   - 作成後の画面で「署名シークレット」→「表示」
   - `whsec_xxxxx...` の形式のキーをコピー
   - これは後でRenderの環境変数に設定

---

## 2. Payment Link（決済リンク）の設定

### 手順：
1. **Payment Link作成**
   - Stripe Dashboard → 「商品」→「Payment Links」
   - 「＋ Payment linkを作成」をクリック

2. **商品設定**
   ```
   商品名: GAS Generator Premium
   価格: ¥10,000
   請求: 月次（毎月）
   ```

3. **高度な設定を開く**
   - 「その他のオプション」→「高度な設定」

4. **URLパラメータ設定** ⚠️重要
   - 「URLパラメータ」セクションを探す
   - 「URLパラメータをプリフィル」を有効化
   - 以下のフィールドを許可：
     - ✅ `client_reference_id` を許可
     - ✅ `prefilled_email` を許可（オプション）

5. **メタデータ設定**
   - 「メタデータ」セクション
   - カスタムフィールドを追加：
     ```
     キー: line_user_id
     値: {client_reference_id}
     ```

6. **確認ページ設定**
   - 「確認ページ」セクション
   - カスタムメッセージ：
   ```
   決済が完了しました！
   LINEに戻って無制限でコード生成をお楽しみください。
   ```

7. **リンクを作成**
   - 設定を保存してリンクを生成
   - URLは以下の形式になります：
   ```
   https://buy.stripe.com/xxxxx
   ```

---

## 3. Stripe APIキーの取得

1. **本番用APIキー取得**
   - Stripe Dashboard → 「開発者」→「APIキー」
   - 「公開可能キー」: `pk_live_xxxxx` （フロントエンドで使用）
   - 「シークレットキー」: `sk_live_xxxxx` （バックエンドで使用）
   - ⚠️ シークレットキーは「表示」をクリックして確認

---

## 4. Render環境変数設定

### Renderダッシュボードで設定：
1. https://dashboard.render.com にログイン
2. 「gasgenerator」サービスを選択
3. 「Environment」タブ
4. 「Add Environment Variable」

### 追加する環境変数：
```bash
# Stripe本番キー
STRIPE_SECRET_KEY=sk_live_51xxxxxxxxxxxxx
# ↑ Step 3で取得したシークレットキー

STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxx
# ↑ Step 1-6で取得した署名シークレット

STRIPE_PUBLISHABLE_KEY=pk_live_51xxxxxxxxxxxxx
# ↑ Step 3で取得した公開可能キー（オプション）

STRIPE_PRICE_ID=price_1xxxxxxxxxxxxx
# ↑ Payment Linkから取得できるPrice ID（オプション）
```

5. **Save Changes** をクリック
6. Renderが自動的に再デプロイされます

---

## 5. テスト方法

### A. Stripeテストモードでテスト（推奨）
1. Stripeダッシュボードで「テストモード」に切り替え
2. テスト用のWebhookとPayment Linkを作成
3. テスト用カード番号: `4242 4242 4242 4242`
4. 有効期限: 任意の未来日付
5. CVC: 任意の3桁

### B. 本番環境でのテスト手順
1. **LINEでテスト**
   - LINEで「こんにちは」と送信
   - 決済ボタンが表示される
   - ボタンをタップしてStripeページへ

2. **URLパラメータ確認**
   - ブラウザのURLを確認
   - `?client_reference_id=xxxxx` が含まれているか確認
   - これがLINE User IDのBase64エンコード値

3. **決済完了後の確認**
   - Stripe Dashboard → 「支払い」で決済確認
   - Render Logs でWebhook受信確認
   - Supabase でユーザーのsubscription_status確認

---

## 6. トラブルシューティング

### 問題: Webhookが受信されない
**解決策:**
```bash
# Renderのログを確認
tail -f /var/log/render.log

# Stripe Dashboard → Webhooks → 該当エンドポイント
# 「イベントとログ」タブで送信履歴確認
```

### 問題: LINE User IDが紐付かない
**解決策:**
1. Payment LinkのURLパラメータ設定を確認
2. `client_reference_id` が許可されているか
3. LINEボタンのURLに正しくパラメータが付いているか

### 問題: 決済後も制限がかかる
**解決策:**
```sql
-- Supabaseで直接確認
SELECT 
  line_user_id,
  subscription_status,
  stripe_customer_id,
  monthly_usage_count
FROM users
WHERE line_user_id = 'YOUR_LINE_USER_ID';
```

---

## 7. LINE側の決済リンク更新

現在のコードでは以下のようになっています：

```typescript
// lib/line/message-templates.ts
const encoded = Buffer.from(lineUserId).toString('base64')
const paymentUrl = `https://buy.stripe.com/7sY3cv2So0v78ICbSz6oo09?client_reference_id=${encoded}`
```

もしPayment LinkのURLが変わった場合は、このURLを更新してください。

---

## 8. 月次更新の自動化

Stripeのサブスクリプション更新は自動で行われますが、
以下のイベントをWebhookで受け取って処理します：

- `invoice.payment_succeeded` - 月次支払い成功
- `invoice.payment_failed` - 支払い失敗
- `customer.subscription.updated` - サブスク更新

これらのイベントも必要に応じてWebhook設定に追加してください。