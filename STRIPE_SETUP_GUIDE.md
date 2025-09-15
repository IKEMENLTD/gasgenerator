# 🔧 Stripe Payment Link 設定ガイド

## 📋 問題の原因
現在、ハードコードされた**無効なStripe Payment LinkのURL**が使用されているため、「Something went wrong」エラーが発生しています。

## ✅ 修正済み内容
以下のファイルで、ハードコードされたURLを環境変数に置き換えました：
- `/lib/line/flex-templates.ts`
- `/app/api/webhook/route.ts`
- `/lib/premium/premium-checker.ts`

## 🚀 必要な設定手順

### Step 1: Stripeで新しいPayment Linkを作成

1. **Stripeダッシュボードにログイン**
   - https://dashboard.stripe.com/

2. **Payment Linkを作成**
   - 左メニューから「Payment links」を選択
   - 「+ New payment link」をクリック

3. **商品情報を設定**
   ```
   商品名: GAS Generator Premium Plan
   価格: ¥10,000
   請求サイクル: 月次（Monthly）
   ```

4. **顧客情報収集を設定**
   - メールアドレス: 必須
   - 名前: オプション

5. **追加設定**
   - 「After payment」→「Don't show confirmation page」
   - カスタムフィールドでclient_reference_idを受け取れるように設定

6. **作成完了**
   - URLをコピー（例: `https://buy.stripe.com/test_xxxxxxxxxxxxx`）

### Step 2: 環境変数を設定

#### ローカル開発環境（.env）
```env
# Stripe設定
STRIPE_PAYMENT_LINK=https://buy.stripe.com/[あなたのPayment Link ID]
STRIPE_SECRET_KEY=sk_test_[あなたのSecret Key]
STRIPE_WEBHOOK_SECRET=whsec_[あなたのWebhook Secret]
```

#### Render本番環境
1. Renderダッシュボードにログイン
2. 「Environment」タブを開く
3. 以下の環境変数を追加：
   - `STRIPE_PAYMENT_LINK` = 作成したPayment LinkのURL
   - `STRIPE_SECRET_KEY` = StripeのSecret Key
   - `STRIPE_WEBHOOK_SECRET` = Webhook用のSecret

### Step 3: Stripe Webhookを設定

1. **Stripeダッシュボードで設定**
   - 「Developers」→「Webhooks」
   - 「Add endpoint」をクリック

2. **エンドポイントURLを設定**
   ```
   https://gasgenerator.onrender.com/api/stripe/webhook
   ```

3. **イベントを選択**
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

4. **Signing secretをコピー**
   - `whsec_xxxxx...`の形式
   - これを`STRIPE_WEBHOOK_SECRET`として環境変数に設定

### Step 4: テスト

#### テストカード情報
```
カード番号: 4242 4242 4242 4242
有効期限: 任意の将来の日付
CVC: 任意の3桁
```

#### テスト手順
1. LINEで制限に達するまでコード生成を実行
2. プレミアムプランへのリンクをタップ
3. Stripeの決済ページが正しく表示されることを確認
4. テストカードで決済
5. 決済完了後、プレミアムステータスが更新されることを確認

## 🔍 トラブルシューティング

### 「Something went wrong」エラーが続く場合
1. Payment LinkのURLが正しいか確認
2. Payment Linkが有効（アクティブ）か確認
3. 環境変数が正しく設定されているか確認

### Webhookが動作しない場合
1. エンドポイントURLが正しいか確認
2. Signing secretが正しいか確認
3. Renderのログでエラーを確認

## 📝 重要な注意事項

- **本番環境への移行時**は、必ず本番用のPayment LinkとAPIキーを使用
- **価格変更**する場合は、新しいPayment Linkを作成
- **client_reference_id**はユーザー識別に必須なので、必ずURLに含める

## 🆘 サポート

問題が解決しない場合は、以下を確認してください：
- Renderのログ
- Stripeダッシュボードのイベントログ
- Supabaseのusersテーブル（is_premiumフラグ）