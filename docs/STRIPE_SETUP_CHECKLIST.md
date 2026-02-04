# TaskMate Stripe連携 セットアップチェックリスト

**作成日**: 2026-02-04
**目的**: りゅうさんと一緒にStripe決済を本番稼働させる

---

## 📋 作業概要

| フェーズ | 所要時間 | 担当 |
|---------|----------|------|
| 1. DBマイグレーション | 5分 | 開発 |
| 2. Stripe設定 | 10分 | りゅうさん |
| 3. Render環境変数設定 | 5分 | 共同 |
| 4. テスト決済 | 10分 | 共同 |
| **合計** | **約30分** | - |

---

## ✅ Phase 1: DBマイグレーション（Supabase）

### 1.1 Supabaseにログイン
- [ ] https://supabase.com/dashboard にアクセス
- [ ] TaskMateプロジェクトを選択

### 1.2 SQL Editorを開く
- [ ] 左メニューの「SQL Editor」をクリック
- [ ] 「New Query」をクリック

### 1.3 マイグレーション1を実行
- [ ] `migrations/001_subscription_and_rag_tables.sql` の内容をコピー
- [ ] SQL Editorに貼り付け
- [ ] 「Run」ボタンをクリック
- [ ] エラーがないことを確認

### 1.4 マイグレーション2を実行
- [ ] `migrations/002_stripe_tables.sql` の内容をコピー
- [ ] SQL Editorに貼り付け
- [ ] 「Run」ボタンをクリック
- [ ] エラーがないことを確認

### 1.5 テーブル作成確認
- [ ] 左メニューの「Table Editor」をクリック
- [ ] 以下のテーブルが存在することを確認:
  - `subscription_plans`（2行のデータあり）
  - `user_subscriptions`
  - `stripe_events`
  - `payment_history`
  - `refunds`

---

## ✅ Phase 2: Stripe設定

### 2.1 Stripeダッシュボードにログイン
- [ ] https://dashboard.stripe.com にアクセス
- [ ] りゅうさんのアカウントでログイン

### 2.2 テストモード確認
- [ ] 右上の「Test mode」トグルがONになっていることを確認
- [ ] ⚠️ 本番テスト中は必ずテストモードで！

### 2.3 APIキーを取得
- [ ] 「Developers」→「API keys」に移動
- [ ] **Secret key** をコピー（`sk_test_` で始まる）
  ```
  STRIPE_SECRET_KEY = sk_test_xxxxxxxxxxxxx
  ```

### 2.4 Payment Linkを確認/作成
- [ ] 「Products」→ 該当商品を選択
- [ ] Payment Linkが存在するか確認
- [ ] なければ「Create payment link」で作成
  ```
  STRIPE_PAYMENT_LINK = https://buy.stripe.com/test_xxxxx
  ```

### 2.5 Webhookを設定
- [ ] 「Developers」→「Webhooks」に移動
- [ ] 「Add endpoint」をクリック
- [ ] 以下を入力:
  - **Endpoint URL**: `https://gasgenerator.onrender.com/api/stripe/webhook`
  - **Events to send**:
    - ✅ `checkout.session.completed`
    - ✅ `customer.subscription.deleted`
    - ✅ `charge.refunded`
- [ ] 「Add endpoint」をクリック
- [ ] **Signing secret** をコピー（`whsec_` で始まる）
  ```
  STRIPE_WEBHOOK_SECRET = whsec_xxxxxxxxxxxxx
  ```

---

## ✅ Phase 3: Render環境変数設定

### 3.1 Renderダッシュボードにログイン
- [ ] https://dashboard.render.com にアクセス
- [ ] 「gasgenerator」サービスを選択

### 3.2 環境変数を追加
- [ ] 「Environment」タブをクリック
- [ ] 以下の環境変数を追加:

| Key | Value | 説明 |
|-----|-------|------|
| `STRIPE_SECRET_KEY` | sk_test_xxxxx | StripeのSecret Key |
| `STRIPE_WEBHOOK_SECRET` | whsec_xxxxx | WebhookのSigning Secret |
| `STRIPE_PAYMENT_LINK` | https://buy.stripe.com/test_xxxxx | Payment Link URL |

- [ ] 「Save Changes」をクリック
- [ ] 自動再デプロイが開始されることを確認

### 3.3 デプロイ完了を待つ
- [ ] 「Logs」タブでデプロイログを確認
- [ ] 「Live」ステータスになるまで待機（約2-3分）

---

## ✅ Phase 4: テスト決済

### 4.1 LINEでテスト
- [ ] TaskMate LINE公式アカウントを開く
- [ ] 「プレミアムプランを見る」と送信
- [ ] Payment Linkが返信されることを確認
- [ ] リンクをタップしてStripe決済ページを開く

### 4.2 テストカードで決済
- [ ] 以下のテストカード情報を入力:
  ```
  カード番号: 4242 4242 4242 4242
  有効期限: 任意の将来日付（例: 12/30）
  CVC: 任意の3桁（例: 123）
  名前: 任意（例: Test User）
  ```
- [ ] 「支払う」をクリック

### 4.3 決済完了確認
- [ ] 決済成功画面が表示されることを確認
- [ ] LINEで「💎 決済が完了しました！」メッセージが届くことを確認

### 4.4 DB確認（Supabase）
- [ ] `users` テーブルで該当ユーザーの `subscription_status` が `premium` になっていることを確認
- [ ] `stripe_events` テーブルにイベントが記録されていることを確認
- [ ] `payment_history` テーブルに決済履歴が記録されていることを確認

### 4.5 Stripe確認
- [ ] Stripeダッシュボードの「Payments」で決済が記録されていることを確認
- [ ] 「Webhooks」→該当エンドポイント→「Recent deliveries」で成功（200）を確認

---

## 🎉 完了チェック

すべて完了したら:

- [ ] テスト決済が正常に動作した
- [ ] LINE通知が届いた
- [ ] DBが正しく更新された
- [ ] Webhookが正常に処理された

### 本番切替（別日に実施）
- [ ] Stripeをライブモードに切替
- [ ] 環境変数を本番用（`sk_live_`）に更新
- [ ] 最終動作確認

---

## 🚨 トラブルシューティング

### Webhookが届かない場合
1. Renderログで`/api/stripe/webhook`へのリクエストを確認
2. Stripe Webhookの「Recent deliveries」でエラーを確認
3. 署名検証エラーの場合、`STRIPE_WEBHOOK_SECRET`が正しいか確認

### 決済後にLINE通知が届かない場合
1. Renderログでエラーを確認
2. `LINE_CHANNEL_ACCESS_TOKEN`が有効か確認
3. ユーザーがLINEをブロックしていないか確認

### DBが更新されない場合
1. Supabaseで`users`テーブルを確認
2. `line_user_id`が正しくデコードされているか確認
3. Renderログで更新エラーを確認

---

## 📞 連絡先

- **開発**: Claude Code セッション
- **Stripe**: https://support.stripe.com/
- **Supabase**: https://supabase.com/docs

---

**このチェックリストで作業を進めてください！**
