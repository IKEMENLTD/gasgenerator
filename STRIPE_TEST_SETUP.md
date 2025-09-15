# 🧪 Stripe テスト環境セットアップガイド

## ✅ 作成完了した内容
- **テスト用Payment Link**: `https://buy.stripe.com/test_5kQ6oHdq63gzbxLbdQ8EM00`
- **商品ID**: `prod_T3jvUMrAIKVOwW`

## 🔧 次に必要な設定

### 1. テスト用のSecret Keyを取得

1. [Stripeダッシュボード](https://dashboard.stripe.com/)にログイン
2. 右上の「Test mode」をONにする
3. 「Developers」→「API keys」
4. **Secret key**をコピー（`sk_test_`で始まる）

### 2. テスト用Webhookを設定

1. Stripeダッシュボード（テストモード）で「Developers」→「Webhooks」
2. 「Add endpoint」をクリック
3. 設定内容：
   ```
   Endpoint URL: https://gasgenerator.onrender.com/api/stripe/webhook

   Events to send:
   - checkout.session.completed
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
   ```
4. 作成後、**Signing secret**（`whsec_`で始まる）をコピー

### 3. Renderの環境変数を更新

⚠️ **重要**: テスト環境と本番環境を切り替える場合

#### A. テスト環境で動作確認する場合：
```env
STRIPE_PAYMENT_LINK=https://buy.stripe.com/test_5kQ6oHdq63gzbxLbdQ8EM00
STRIPE_SECRET_KEY=[テスト用Secret Key: sk_test_xxxxx]
STRIPE_WEBHOOK_SECRET=[テスト用Webhook Secret: whsec_xxxxx]
```

#### B. 本番環境に戻す場合：
```env
STRIPE_PAYMENT_LINK=[本番用Payment LinkのURL]
STRIPE_SECRET_KEY=[本番用Secret Key - Stripeダッシュボードから取得]
STRIPE_WEBHOOK_SECRET=whsec_C1FXcTbkB405EFTGozR3V8fo81eejyqm
```

### 4. テスト決済の実行

#### テストカード情報
```
カード番号: 4242 4242 4242 4242
有効期限: 任意の将来の日付（例: 12/25）
CVC: 任意の3桁（例: 123）
郵便番号: 任意（例: 10000）
```

#### テスト手順
1. LINEで「プレミアムプランを見る」と送信
2. 表示されたリンクをタップ
3. Stripeの決済ページが表示されることを確認
4. テストカード情報を入力
5. 「Subscribe」ボタンをクリック
6. 決済が成功することを確認

### 5. 動作確認ポイント

✅ **決済ページ**
- URLが正しく開くか
- 商品情報（価格・説明）が正しく表示されるか
- client_reference_idがURLに含まれているか

✅ **決済後**
- Webhookが正しく受信されるか（Renderのログを確認）
- Supabaseのusersテーブルでis_premiumがtrueになるか
- LINEで制限が解除されるか

## 📝 トラブルシューティング

### 「Something went wrong」が表示される場合
- Payment LinkのURLが正しいか確認
- Secret Keyがテスト用（sk_test_）になっているか確認

### Webhookが動作しない場合
- Webhook Secretがテスト用になっているか確認
- RenderのログでWebhookエラーを確認

### 決済後もプレミアムにならない場合
- client_reference_idが正しく渡されているか確認
- Supabaseのusersテーブルを直接確認

## 🚀 本番移行チェックリスト

テストが完了したら：

- [ ] 本番用のPayment Linkを作成
- [ ] 環境変数を本番用に戻す
- [ ] 本番用のWebhookを設定
- [ ] 実際の決済で動作確認（小額でテスト後、返金）

## 💡 Tips

- テスト環境では何度でも無料でテストできます
- Stripeダッシュボードの「Events」タブでWebhookの送信状況を確認できます
- テストモードの決済はダッシュボードで「Test Data」として表示されます