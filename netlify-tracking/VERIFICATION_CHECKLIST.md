# 🔍 システム確認チェックリスト

以下の項目を順番に確認してください。各項目の結果を記録してください。

---

## 📋 確認項目一覧

- [ ] Netlify環境変数（10個）
- [ ] LINE Webhook URL設定
- [ ] Stripe Webhook URL設定
- [ ] Netlify Function Logs
- [ ] Supabaseデータ確認

---

## 1️⃣ Netlify環境変数の確認

### アクセス方法
```
1. https://app.netlify.com/ を開く
2. "gas-generator" または "netlify-tracking" サイトを選択
3. Site settings → Environment variables
```

### 確認すべき環境変数（10個）

| 変数名 | 設定されているか | 値の先頭3文字 | 備考 |
|--------|-----------------|--------------|------|
| `SUPABASE_URL` | ☐ Yes ☐ No | https:// | |
| `SUPABASE_SERVICE_ROLE_KEY` | ☐ Yes ☐ No | eyJ... | |
| `LINE_CHANNEL_ACCESS_TOKEN` | ☐ Yes ☐ No |  | |
| `LINE_CHANNEL_SECRET` | ☐ Yes ☐ No |  | |
| `LINE_OFFICIAL_URL` | ☐ Yes ☐ No | https://lin.ee/ | ✅ 既知: https://lin.ee/FMy4xlx |
| `STRIPE_SECRET_KEY` | ☐ Yes ☐ No | sk_test_ または sk_live_ | |
| `STRIPE_WEBHOOK_SECRET` | ☐ Yes ☐ No | whsec_ | 🔴 最重要！ |
| `JWT_SECRET` | ☐ Yes ☐ No |  | |
| `ADMIN_USERNAME` | ☐ Yes ☐ No |  | オプション |
| `ADMIN_PASSWORD_HASH` | ☐ Yes ☐ No | $2a$10$ | オプション |

### ⚠️ 特に重要な変数

#### `STRIPE_WEBHOOK_SECRET`
- **なぜ重要**: これがないとStripe Webhookが署名検証に失敗し、コンバージョンが記録されない
- **取得方法**: Stripe Dashboard → Developers → Webhooks → エンドポイント → Signing secret
- **形式**: `whsec_XXXXXXXXXXXXXXXXXXXXXXXXXX`

#### `LINE_CHANNEL_ACCESS_TOKEN`
- **なぜ重要**: これがないとLINEメッセージが送信できない
- **取得方法**: LINE Developers Console → Messaging API設定 → Channel access token (long-lived)

#### `LINE_CHANNEL_SECRET`
- **なぜ重要**: これがないとLINE Webhook署名検証に失敗
- **取得方法**: LINE Developers Console → Basic settings → Channel secret

---

## 2️⃣ LINE Webhook URL設定の確認

### アクセス方法
```
1. https://developers.line.biz/console/ を開く
2. プロバイダーを選択
3. "Messaging API" チャンネルを選択
4. "Messaging API設定" タブを開く
```

### 確認項目

#### Webhook URL
```
現在の設定値: _________________________________

正しい値: https://taskmateai.net/.netlify/functions/line-webhook
```

☐ 設定値は正しいか？
☐ URLの末尾に余分な "/" がないか？
☐ "http" ではなく "https" か？

#### Webhook設定

☐ **Use webhook**: ON になっているか？
☐ **Webhook redelivery**: ON になっているか？（推奨）

#### Webhookテスト

1. **Verify** ボタンをクリック
2. 結果を記録:

```
☐ Success (200 OK)
☐ Error: ________________________________________
```

**Errorの場合の原因**:
- 環境変数 `LINE_CHANNEL_SECRET` が間違っている
- Netlify Functionがデプロイされていない
- URLが間違っている

#### イベント設定

以下のイベントが有効になっているか確認:

☐ **Message events**: ON
☐ **Follow events**: ON
☐ **Unfollow events**: ON

---

## 3️⃣ Stripe Webhook URL設定の確認

### アクセス方法
```
1. https://dashboard.stripe.com/ を開く
2. Developers → Webhooks を選択
```

### 確認項目

#### Webhookエンドポイントの存在

☐ エンドポイントが登録されているか？

**登録されている場合**:
```
URL: _________________________________
Status: ☐ Enabled ☐ Disabled

正しいURL: https://taskmateai.net/.netlify/functions/stripe-webhook
```

**登録されていない場合**:
→ 後で登録手順を実行（下記参照）

#### イベント設定

以下のイベントが選択されているか確認:

☐ `payment_intent.succeeded`
☐ `checkout.session.completed`
☐ `customer.created`
☐ `invoice.payment_succeeded`

#### Signing Secret

1. エンドポイントを選択
2. **Signing secret** セクションで「Reveal」をクリック
3. 値をコピー: `whsec_XXXXXXXXXXXXXXXXX`
4. ☐ この値がNetlifyの `STRIPE_WEBHOOK_SECRET` に設定されているか確認

#### Recent Deliveries

最近のWebhook配信履歴を確認:

```
配信回数: _________回
成功: _________回
失敗: _________回

最新の配信ステータス:
☐ 200 OK (成功)
☐ 400 Bad Request
☐ 401 Unauthorized (署名検証失敗)
☐ 500 Internal Server Error
```

---

## 4️⃣ Netlify Function Logsの確認

### アクセス方法
```
1. https://app.netlify.com/ を開く
2. サイトを選択
3. Functions タブを開く
```

### line-webhook ログ確認

1. **line-webhook** 関数を選択
2. **Logs** タブを開く
3. 最近のログを確認:

```
ログは表示されているか？
☐ Yes - どんなログ？: _________________________________
☐ No - ログが一切ない

エラーログはあるか？
☐ Yes - エラー内容: _________________________________
☐ No
```

**期待されるログ**:
```
=== FOLLOW EVENT 受信 ===
LINE User ID: UXXXXXXXXX
✅ 代理店登録の友達追加を検知
```

### stripe-webhook ログ確認

1. **stripe-webhook** 関数を選択
2. **Logs** タブを開く
3. 最近のログを確認:

```
ログは表示されているか？
☐ Yes - どんなログ？: _________________________________
☐ No - ログが一切ない（正常: まだ課金がない）

エラーログはあるか？
☐ Yes - エラー内容: _________________________________
☐ No
```

---

## 5️⃣ Supabaseデータ確認

### アクセス方法
```
1. https://supabase.com/dashboard を開く
2. プロジェクトを選択
3. SQL Editor を開く
```

### 確認SQL

以下のSQLを順番に実行し、結果を記録:

#### A) 代理店情報確認
```sql
SELECT
    id,
    code,
    name,
    status,
    line_user_id,
    created_at
FROM agencies
ORDER BY created_at DESC
LIMIT 5;
```

**結果**:
```
代理店数: _________件
あなたの代理店ID: _________________________________
ステータス: _________
LINE User ID: ☐ 設定済み ☐ NULL
```

#### B) コンバージョン確認
```sql
SELECT COUNT(*) as total_conversions
FROM agency_conversions;
```

**結果**: _________件

**もし0件の場合**:
→ これが問題！Webhookが動作していない、またはまだテストしていない

#### C) 訪問記録確認
```sql
SELECT COUNT(*) as total_visits
FROM agency_tracking_visits;
```

**結果**: _________件（既知: 11件）

#### D) usersテーブル確認
```sql
SELECT
    id,
    line_user_id,
    subscription_status,
    is_premium,
    stripe_customer_id,
    created_at
FROM users
ORDER BY created_at DESC
LIMIT 5;
```

**結果**:
```
ユーザー数: _________件
課金ユーザー: _________件
```

#### E) line_usersテーブル確認（もし存在すれば）
```sql
SELECT COUNT(*) FROM line_users;
```

**結果**: _________件

---

## 📊 診断結果の判定

### パターン1: Netlify環境変数が不足
```
☐ LINE_CHANNEL_SECRET が未設定
☐ STRIPE_WEBHOOK_SECRET が未設定
→ 対処: 環境変数を設定してデプロイ
```

### パターン2: Webhook URLが未設定
```
☐ LINE Webhook URLが登録されていない
☐ Stripe Webhook URLが登録されていない
→ 対処: URLを登録
```

### パターン3: Webhook URLが間違っている
```
☐ LINE Webhook Verify が失敗
☐ Stripe Recent Deliveries で 401 Unauthorized
→ 対処: URLを修正、または環境変数を確認
```

### パターン4: まだテストしていない
```
☐ コンバージョン: 0件
☐ Netlify Logs: 何も表示されない
☐ Stripe Recent Deliveries: 空
→ 対処: 実際にLINE友達追加 or 課金テストを実行
```

---

## ✅ チェックリスト完了後

すべての項目を確認したら、以下の情報をまとめてください:

### 確認結果サマリー

```
【Netlify環境変数】
設定済み: _____ / 10
未設定: _________________________________

【LINE Webhook】
URL設定: ☐ 正常 ☐ 未設定 ☐ 間違い
Verify結果: ☐ Success ☐ Error
エラー内容: _________________________________

【Stripe Webhook】
URL設定: ☐ 正常 ☐ 未設定 ☐ 間違い
Recent Deliveries: _____ 回（成功: _____ / 失敗: _____）

【コンバージョン】
総数: _____ 件
LINE友達追加: _____ 件
Stripe決済: _____ 件

【診断結果】
問題点: _________________________________
次のアクション: _________________________________
```

---

## 🚨 よくある問題と解決方法

### 問題1: LINE Webhook Verifyが失敗
**原因**: LINE_CHANNEL_SECRETが間違っている
**解決**:
1. LINE Developers Console → Basic settings → Channel secret をコピー
2. Netlify → Environment variables → LINE_CHANNEL_SECRET を更新
3. Netlify → Deploys → Trigger deploy

### 問題2: Stripe Webhookが401 Unauthorized
**原因**: STRIPE_WEBHOOK_SECRETが間違っている
**解決**:
1. Stripe Dashboard → Webhooks → エンドポイント → Signing secret をコピー
2. Netlify → Environment variables → STRIPE_WEBHOOK_SECRET を更新
3. Netlify → Deploys → Trigger deploy

### 問題3: コンバージョンが0件
**原因**: まだテストしていない、またはWebhookが動作していない
**解決**:
1. 上記の問題1, 2を解決
2. 実際にLINE友達追加テストを実行
3. Netlify Function Logsでログを確認

---

**作成日**: 2025年10月20日
**最終更新**: 2025年10月20日
