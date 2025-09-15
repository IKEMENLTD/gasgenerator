# 🚨 緊急: 新しいStripe Payment Linkの作成が必要

## 現在の状況
- **STRIPE_PAYMENT_LINK**: `https://buy.stripe.com/7sY3cv2So0v78ICbSz6oo09` (無効)
- このURLにアクセスすると「Something went wrong」エラーが表示される

## 作成手順

### 1. Stripeダッシュボードにログイン
https://dashboard.stripe.com/

### 2. Payment Linkを新規作成
1. 左メニューから「Payment links」を選択
2. 「+ New payment link」をクリック

### 3. 商品設定
```
商品名: GAS Generator Premium
説明: 無制限のコード生成・優先サポート付き
価格: ¥10,000
請求: 月次（Recurring - Monthly）
```

### 4. オプション設定
- ✅ Collect customer details
  - Email: Required
  - Name: Optional
- ✅ Allow promotion codes
- ✅ Adjustable quantity: OFF

### 5. After payment設定
- Don't show confirmation page
- Redirect to: https://gasgenerator.onrender.com/premium/success

### 6. Advanced options
- Metadata/URLパラメータ設定
  - client_reference_idパラメータを受け付けるように設定
  - これによりユーザーIDを渡せるようになる

### 7. 作成完了
新しいPayment LinkのURLをコピー
例: `https://buy.stripe.com/live_xxxxxxxxxxxxxxxxx`

## Renderで環境変数を更新

1. Renderダッシュボードにログイン
2. Environment Variablesセクション
3. **STRIPE_PAYMENT_LINK** を新しいURLに更新
4. Save Changes
5. サービスが自動的に再デプロイされる

## テスト確認

### テスト用Payment Link（推奨）
まずテストモードでPayment Linkを作成してテスト：
- テストURL: `https://buy.stripe.com/test_xxxxxxxxx`
- テストカード: 4242 4242 4242 4242

### 本番用Payment Link
テストが成功したら本番用を作成：
- 本番URL: `https://buy.stripe.com/live_xxxxxxxxx`

## 重要な注意点

⚠️ **現在のSTRIPE_SECRET_KEY**は本番用（`sk_live_`で始まる）なので、Payment Linkも本番用を作成する必要があります。

もしテストしたい場合は：
1. テスト用のPayment Linkを作成
2. STRIPE_SECRET_KEYもテスト用（`sk_test_`）に一時的に変更
3. テスト完了後、本番に戻す