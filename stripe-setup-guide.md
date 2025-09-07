# Stripe環境変数設定ガイド

## 🔑 STRIPE_WEBHOOK_SECRET の取得方法

### Step 1: Stripe Dashboardにログイン
1. [Stripe Dashboard](https://dashboard.stripe.com) にアクセス
2. アカウントにログイン

### Step 2: Webhookエンドポイントの作成
1. 左メニューから「**開発者**」をクリック
2. 「**Webhook**」タブを選択
3. 「**エンドポイントを追加**」ボタンをクリック

### Step 3: エンドポイントURLの設定
1. **エンドポイントURL**を入力：
   ```
   https://あなたのドメイン.com/api/stripe/webhook
   ```
   例：
   - Render.com: `https://gas-generator.onrender.com/api/stripe/webhook`
   - Vercel: `https://your-app.vercel.app/api/stripe/webhook`

2. **リッスンするイベント**を選択：
   - 「**イベントを選択**」をクリック
   - 以下のイベントを追加：
     - ✅ `checkout.session.completed` （決済完了）
     - ✅ `customer.subscription.deleted` （サブスク解約）
     - ✅ `customer.subscription.updated` （サブスク更新）

3. 「**エンドポイントを追加**」をクリック

### Step 4: Webhook Secretの取得
1. 作成したエンドポイントの詳細ページが開く
2. 「**署名シークレット**」セクションを探す
3. 「**表示**」をクリック
4. `whsec_` で始まる文字列をコピー

```bash
# .env.local に追加
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
```

---

## 💳 STRIPE_PRICE_ID の取得方法

### Step 1: 商品と価格の作成
1. Stripe Dashboardの「**商品**」タブを開く
2. 「**商品を追加**」をクリック

### Step 2: 商品情報の入力
1. **商品名**: 例「GASコード生成 月額プラン」
2. **説明**: 例「無制限のGASコード生成が可能な月額プラン」
3. **画像**: オプション（アップロード可能）

### Step 3: 価格設定
1. **価格モデル**: 「**定期的**」を選択
2. **価格**: 
   - 金額: `1000` 円
   - 請求期間: `月次`
3. **価格ID**: 
   - カスタムIDを設定可能（例: `monthly_1000`）
   - 空欄の場合は自動生成される

### Step 4: Price IDの取得
1. 商品を保存後、商品詳細ページを開く
2. 価格セクションで価格をクリック
3. 価格IDが表示される（`price_` で始まる文字列）
4. このIDをコピー

```bash
# .env.local に追加
STRIPE_PRICE_ID=price_1234567890abcdef...
```

---

## 🔐 その他の必要なStripe環境変数

### 本番環境用のキー取得

1. **STRIPE_PUBLISHABLE_KEY**（公開可能キー）
   - Dashboard → 開発者 → APIキー
   - 「公開可能キー」をコピー
   - `pk_live_` で始まる

2. **STRIPE_SECRET_KEY**（シークレットキー）
   - Dashboard → 開発者 → APIキー
   - 「シークレットキー」の「表示」をクリック
   - `sk_live_` で始まる
   - ⚠️ **絶対に公開しない**

### テスト環境用のキー

開発中はテストキーを使用：
- 公開可能キー: `pk_test_...`
- シークレットキー: `sk_test_...`
- テストモードのトグルで切り替え可能

---

## 📝 最終的な.env.local設定

```bash
# Stripe本番環境
STRIPE_PUBLISHABLE_KEY=pk_live_51234567890...
STRIPE_SECRET_KEY=sk_live_51234567890...
STRIPE_WEBHOOK_SECRET=whsec_1234567890...
STRIPE_PRICE_ID=price_1234567890...

# Stripeテスト環境（開発用）
# STRIPE_PUBLISHABLE_KEY=pk_test_51234567890...
# STRIPE_SECRET_KEY=sk_test_51234567890...
# STRIPE_WEBHOOK_SECRET=whsec_test_1234567890...
# STRIPE_PRICE_ID=price_test_1234567890...
```

---

## ✅ チェックリスト

- [ ] Stripe Dashboardにログイン済み
- [ ] Webhookエンドポイント作成済み
- [ ] Webhook Secret取得済み（`whsec_`で始まる）
- [ ] 商品・価格作成済み
- [ ] Price ID取得済み（`price_`で始まる）
- [ ] APIキー取得済み（本番用）
- [ ] .env.localファイルに設定済み
- [ ] アプリケーションを再起動済み

---

## 🧪 動作テスト方法

### 1. Webhook接続テスト
```bash
# Stripe CLIを使用（要インストール）
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 別ターミナルで
stripe trigger checkout.session.completed
```

### 2. 決済リンクテスト
1. LINEボットに「決済」と送信
2. 決済リンクが返ってくることを確認
3. テストカード番号: `4242 4242 4242 4242`
4. 有効期限: 任意の将来の日付
5. CVC: 任意の3桁

### 3. 本番環境での確認
- Stripe Dashboard → イベント
- Webhookの送信ログを確認
- 成功/失敗のステータスをチェック

---

## ⚠️ トラブルシューティング

### Webhook署名エラーの場合
1. Webhook Secretが正しくコピーされているか確認
2. 環境変数が正しく読み込まれているか確認
3. エンドポイントURLが正確か確認

### 決済が反映されない場合
1. Webhookイベントログを確認
2. データベースのusersテーブルを確認
3. LINE_USER_IDのBase64エンコード/デコードを確認

### Price IDエラーの場合
1. 本番モード/テストモードの切り替えを確認
2. Price IDが正しい環境のものか確認
3. 商品がアクティブになっているか確認

---

## 📞 サポート

問題が解決しない場合：
1. Stripe Supportに問い合わせ
2. [Stripe公式ドキュメント](https://stripe.com/docs)を参照
3. エラーログを詳細に確認