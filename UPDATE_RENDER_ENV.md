# 🔴 緊急: Render環境変数の更新

## 本番用Payment Link情報
- **商品ID**: `prod_SyK4heITXlIIbb`
- **Payment Link URL**: `https://buy.stripe.com/7sY3cv2So0v78ICbSz6oo09`

## Renderで更新する環境変数

### 1. Renderダッシュボードにログイン
https://dashboard.render.com/

### 2. Environment Variablesを更新

現在の設定（無効）:
```
STRIPE_PAYMENT_LINK=https://buy.stripe.com/7sY3cv2So0v78ICbSz6oo09
```

新しい設定（本番）:
```
STRIPE_PAYMENT_LINK=https://buy.stripe.com/7sY3cv2So0v78ICbSz6oo09
```

⚠️ **URLは同じに見えますが、Stripeで再作成されたので有効になっているはずです**

### 3. その他の環境変数（既に設定済み・変更不要）
```
STRIPE_SECRET_KEY=sk_live_[REDACTED - Already configured in Render]
STRIPE_WEBHOOK_SECRET=whsec_C1FXcTbkB405EFTGozR3V8fo81eejyqm
STRIPE_PRODUCT_ID=prod_SyK4heITXlIIbb
```

## 確認手順

### 1. Payment Linkの動作確認
1. ブラウザで直接URLにアクセス: https://buy.stripe.com/7sY3cv2So0v78ICbSz6oo09
2. Stripeの決済ページが正しく表示されることを確認
3. 商品名と価格（¥10,000/月）が表示されることを確認

### 2. LINEからのテスト
1. LINEで制限メッセージが表示されるまでコード生成
2. 「プレミアムプランを見る」ボタンをタップ
3. Stripe決済ページが開くことを確認

### 3. Webhook設定の確認
Stripeダッシュボードで：
1. 「Developers」→「Webhooks」
2. 本番用のWebhookエンドポイントが設定されているか確認
   - URL: `https://gasgenerator.onrender.com/api/stripe/webhook`
   - Events:
     - checkout.session.completed
     - customer.subscription.created
     - customer.subscription.updated
     - customer.subscription.deleted

## ⚠️ 重要な注意事項

1. **本番環境**なので、実際の決済が発生します
2. テストする場合は、決済後にStripeダッシュボードから返金処理を行ってください
3. URLにclient_reference_idパラメータが自動的に追加されることを確認

## 🎯 期待される動作

1. ユーザーがPayment Linkをクリック
2. Stripe決済ページが表示される（エラーなし）
3. 決済完了後、Webhookが受信される
4. Supabaseのusersテーブルでis_premium=trueになる
5. LINEで無制限にコード生成可能になる

## 📝 トラブルシューティング

### まだ「Something went wrong」が表示される場合
1. Payment LinkがStripeダッシュボードで「Active」になっているか確認
2. 商品（prod_SyK4heITXlIIbb）が有効か確認
3. 価格設定が正しいか確認

### 決済は成功するがプレミアムにならない場合
1. Webhookが正しく設定されているか確認
2. RenderのログでWebhookエラーを確認
3. client_reference_idが正しく渡されているか確認

## 🔍 ログ確認コマンド
```bash
# Renderのログを確認
# Renderダッシュボード → Logs

# 特に以下のログを確認：
- "Stripe webhook received"
- "checkout.session.completed"
- "Premium status updated"
```