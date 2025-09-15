# Stripe Payment Link 修正ガイド

## 🔴 現在の問題
- 複数の古い/無効なStripe Payment LinkのURLが使用されている
- これらのURLにアクセスすると「Something went wrong」エラーが表示される

## 🛠️ 修正手順

### 1. Stripeダッシュボードで新しいPayment Linkを作成

1. [Stripe Dashboard](https://dashboard.stripe.com/)にログイン
2. 「Payment Links」セクションへ移動
3. 「+ New payment link」をクリック
4. 以下の設定で作成：
   - **商品名**: GAS Generator Premium Plan
   - **価格**: ¥10,000
   - **請求サイクル**: 月次（Monthly）
   - **顧客情報収集**: メールアドレス必須
   - **メタデータ**: client_reference_idパラメータを受け付けるように設定

### 2. 環境変数を更新

`.env`ファイルに新しいPayment LinkのURLを設定：

```env
STRIPE_PAYMENT_LINK=https://buy.stripe.com/[新しいリンクID]
```

### 3. コード内のハードコードされたURLを修正

以下のファイルで直接URLが記載されている箇所を環境変数に置き換える：

#### `/lib/line/flex-templates.ts`
```typescript
// 変更前
uri: 'https://buy.stripe.com/7sY3cv2So0v78ICbSz6oo09'

// 変更後
uri: process.env.STRIPE_PAYMENT_LINK || ''
```

```typescript
// 変更前
const paymentUrl = `https://buy.stripe.com/7sY3cv2So0v78ICbSz6oo09?client_reference_id=${encoded}`

// 変更後
const paymentUrl = `${process.env.STRIPE_PAYMENT_LINK}?client_reference_id=${encoded}`
```

#### `/app/api/webhook/route.ts`
```typescript
// 変更前
uri: `https://buy.stripe.com/8wMdTAc9m8zQgmI9AA?client_reference_id=${encodedUserId}`

// 変更後
uri: `${process.env.STRIPE_PAYMENT_LINK}?client_reference_id=${encodedUserId}`
```

#### `/lib/premium/premium-checker.ts`
```typescript
// 変更前
return `https://buy.stripe.com/8wMdTAc9m8zQgmI9AA?client_reference_id=${encodedUserId}`

// 変更後
return `${process.env.STRIPE_PAYMENT_LINK}?client_reference_id=${encodedUserId}`
```

### 4. Stripe Webhookの設定

1. Stripeダッシュボードで「Developers」→「Webhooks」
2. エンドポイントを追加：`https://gasgenerator.onrender.com/api/stripe/webhook`
3. 以下のイベントをリッスン：
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

### 5. 環境変数をRenderに設定

Renderのダッシュボードで以下の環境変数を設定：
- `STRIPE_PAYMENT_LINK`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## 📝 テスト手順

1. テストモードでPayment Linkを作成
2. テスト用クレジットカード（4242 4242 4242 4242）で決済をテスト
3. Webhookが正しく受信されることを確認
4. ユーザーのプレミアムステータスが更新されることを確認

## ⚠️ 注意事項

- 本番環境に移行する際は、必ず本番用のPayment Linkを作成する
- URLは環境変数で管理し、ハードコーディングは避ける
- client_reference_idはユーザー識別のために重要なので必ず含める