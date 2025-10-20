# 🎯 最終アクションプラン - 課金情報表示修正

**作成日**: 2025年10月20日
**目的**: `billingUsers: Array(0)` 問題を解決し、コンバージョントラッキングを完全に機能させる

---

## 🚨 重要な発見: LINE URL の不一致

### 発見された2つの異なるURL

1. **`.env.local`内の値**:
   ```
   LINE_FRIEND_URL=https://lin.ee/1wyjuRu
   ```

2. **ユーザーが言及した値**:
   ```
   https://lin.ee/FMy4xlx
   ```

### ⚠️ どちらが正しいか

**推奨**: `https://lin.ee/FMy4xlx` を使用

**理由**:
- ユーザーが「既にあるよ」と明示的に言及
- より最近の情報である可能性が高い
- `.env.local`は古い開発環境の設定かもしれない

---

## 📋 STEP 1: Netlify環境変数を設定（15分）

### アクセス方法
```
1. https://app.netlify.com/ を開く
2. "netlify-tracking" または "gas-generator" サイトを選択
3. Site settings → Environment variables
4. Add a variable をクリック
```

### 設定すべき環境変数リスト

#### 🔴 最優先（Webhook動作に必須）

| Key | Value | Scope |
|-----|-------|-------|
| `STRIPE_WEBHOOK_SECRET` | `whsec_C1FXcTbkB405EFTGozR3V8fo81eejyqm` | All deploys |
| `LINE_CHANNEL_SECRET` | `0917a4d9a8422c86990ca5123e273e7c` | All deploys |
| `LINE_CHANNEL_ACCESS_TOKEN` | `a/iQAlWnnVy+NJtPXOhCl29mEXCvfHCdz9+ZyeEX6mUSpI2T2pEMqXtL5NwzRbXR60LqdOVkz0ZhPWzZQ5PTBC/LUQhhkA+1vShVDNs05nhVzOLJGrlRUVivQadWsu85x9RFQ8ShohkAbL+on0F59AdB04t89/1O/w1cDnyilFU=` | All deploys |
| `LINE_OFFICIAL_URL` | `https://lin.ee/FMy4xlx` | All deploys |

#### 🟡 必須（データベース接続）

| Key | Value | Scope |
|-----|-------|-------|
| `SUPABASE_URL` | `https://ebtcowcgkdurqdqcjrxy.supabase.co` | All deploys |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidGNvd2Nna2R1cnFkcWNqcnh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY5MjAxNCwiZXhwIjoyMDcyMjY4MDE0fQ.RSMxrry0nrBDgvZEtc9s1hAFW_ojiiIU8YgACF48cCY` | All deploys |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVidGNvd2Nna2R1cnFkcWNqcnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2OTIwMTQsImV4cCI6MjA3MjI2ODAxNH0.vFOJ4HLmteDMzzQthfbZD3_eRbr4ni0qOpFLmvYyfJI` | All deploys |

#### 🟢 必須（Stripe決済）

| Key | Value | Scope |
|-----|-------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_xxxxx[REDACTED]` | All deploys |

#### 🔵 推奨（セキュリティ）

| Key | Value | Scope |
|-----|-------|-------|
| `JWT_SECRET` | `your-secret-key-here-at-least-32-characters-long-random-string` | All deploys |

**注意**: `JWT_SECRET`は新規生成を推奨。以下のコマンドで生成可能:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📋 STEP 2: 環境変数設定の確認（5分）

### スクリーンショットと照合

提供されたNetlifyスクリーンショット（oidfh9.png）で、以下の変数が設定されているか確認:

```
検索ボックスで以下を検索:

☐ STRIPE_WEBHOOK_SECRET
☐ LINE_CHANNEL_SECRET
☐ LINE_CHANNEL_ACCESS_TOKEN
☐ LINE_OFFICIAL_URL
☐ SUPABASE_SERVICE_ROLE_KEY
```

### 設定されていない変数がある場合

→ STEP 1の表からコピーして追加

---

## 📋 STEP 3: Netlify再デプロイ（3分）

環境変数を追加/変更した場合、**必ず再デプロイが必要**:

```
1. Netlify Dashboard
2. Deploys タブ
3. Trigger deploy → Deploy site
4. デプロイ完了を待つ（1-2分）
```

---

## 📋 STEP 4: LINE Webhook URLを設定（5分）

### アクセス方法
```
1. https://developers.line.biz/console/ を開く
2. プロバイダーを選択
3. "Messaging API" チャンネルを選択
4. "Messaging API設定" タブを開く
```

### 設定内容

#### Webhook URL
```
https://taskmateai.net/.netlify/functions/line-webhook
```

**重要**:
- ☐ URLの末尾に余分な `/` がないこと
- ☐ `https` であること（`http`ではない）
- ☐ ドメイン名が `taskmateai.net` であること

#### Webhook設定

- ☐ **Use webhook**: `ON` に設定
- ☐ **Webhook redelivery**: `ON` に設定（推奨）

#### Webhookテスト

1. **Verify** ボタンをクリック
2. 結果を確認:

**期待される結果**:
```
✅ Success (200 OK)
```

**エラーが出た場合**:
```
❌ Error (401 Unauthorized)
→ LINE_CHANNEL_SECRETが間違っている可能性
→ Netlifyが再デプロイされていない可能性

❌ Error (404 Not Found)
→ URLが間違っている
→ Functionがデプロイされていない
```

---

## 📋 STEP 5: Stripe Webhook URLを設定（10分）

### アクセス方法
```
1. https://dashboard.stripe.com/webhooks を開く
2. "Add endpoint" をクリック
```

### エンドポイント設定

#### Endpoint URL
```
https://taskmateai.net/.netlify/functions/stripe-webhook
```

#### Events to send

以下のイベントを選択:
- ☐ `payment_intent.succeeded`
- ☐ `checkout.session.completed`
- ☐ `customer.created`
- ☐ `invoice.payment_succeeded`

#### Signing secret の確認

1. エンドポイントを作成後、詳細ページを開く
2. **Signing secret** セクションで「Reveal」をクリック
3. 表示された値を確認: `whsec_C1FXcTbkB405EFTGozR3V8fo81eejyqm`
4. この値がNetlifyの `STRIPE_WEBHOOK_SECRET` と一致することを確認

**不一致の場合**:
- Netlifyの `STRIPE_WEBHOOK_SECRET` を更新
- Netlifyを再デプロイ

---

## 📋 STEP 6: テスト実行（15分）

### テスト1: LINE友達追加

#### 実行手順
```
1. トラッキングリンクにアクセス:
   https://taskmateai.net/t/8f5yoytw84zp

2. LINE友達追加ボタンをクリック

3. LINEアプリが開くことを確認

4. 友達追加を実行
```

#### 期待される動作
```
✅ LINEアプリが自動的に開く
✅ 友達追加画面が表示される
✅ 友達追加後、ウェルカムメッセージが届く
```

#### 確認すべきログ

**Netlify Function Logs**:
```
1. Netlify Dashboard
2. Functions → line-webhook
3. Logs タブ

期待されるログ:
=== FOLLOW EVENT 受信 ===
LINE User ID: UXXXXXXXXX
✅ 代理店登録の友達追加を検知
```

**Supabase SQL**:
```sql
-- コンバージョン確認
SELECT * FROM agency_conversions
WHERE conversion_type = 'line_friend'
ORDER BY created_at DESC LIMIT 5;
```

**期待される結果**: 1件以上のレコードが追加されている

### テスト2: Stripe Webhook確認

#### Stripe Dashboard での確認
```
1. https://dashboard.stripe.com/webhooks を開く
2. エンドポイントを選択
3. "Recent deliveries" タブを確認
```

**まだ実際の決済がない場合**: 配信履歴は空でOK

**テストイベントを送信する場合**:
```
1. "Send test webhook" をクリック
2. "payment_intent.succeeded" を選択
3. Send test webhook
4. ステータスが "200 OK" になることを確認
```

---

## 📋 STEP 7: データ確認（5分）

### Supabase SQL Editorで実行

#### A) コンバージョン総数
```sql
SELECT
    conversion_type,
    COUNT(*) as count
FROM agency_conversions
GROUP BY conversion_type;
```

**期待される結果** (LINE友達追加テスト後):
```
conversion_type | count
----------------|------
line_friend     | 1
```

#### B) 課金ユーザー確認
```sql
SELECT
    u.id,
    u.line_user_id,
    u.subscription_status,
    u.is_premium,
    u.stripe_customer_id,
    u.created_at
FROM users u
WHERE u.subscription_status IS NOT NULL
  AND u.subscription_status != 'free'
ORDER BY u.created_at DESC
LIMIT 5;
```

**期待される結果** (まだ課金なし):
```
(0 rows)
```

#### C) 訪問記録確認
```sql
SELECT COUNT(*) as total_visits
FROM agency_tracking_visits
WHERE agency_id = '295a08d0-9e62-4935-af8e-6efd06566296';
```

**期待される結果**: 11件以上（既存の訪問 + 新規テスト）

---

## 📋 STEP 8: ダッシュボード確認（5分）

### 代理店ダッシュボードでリロード

```
1. https://taskmateai.net/agency/dashboard にアクセス
2. ログイン（既にログイン済み）
3. ページをリロード（F5）
4. コンソールログを確認（F12 → Console）
```

### 確認すべき内容

#### コンソールログ
```
期待されるログ:
Billing stats loaded: {
    summary: {...},
    billingUsers: Array(0),  ← まだ課金なしの場合
    lastUpdated: '2025-10-20T...'
}
```

#### 画面表示

**「訪問」タブ**:
```
✅ 11訪問以上が表示される
✅ 最新の訪問日時が更新されている
```

**「課金情報」タブ**:
```
⚠️ billingUsers: 0件 ← これは正常（まだ課金ユーザーがいないため）
```

---

## 🎯 成功の判定基準

### ✅ 最低限達成すべき項目

- [ ] LINE友達追加でLINEアプリが自動的に開く
- [ ] LINE Webhook Verifyが成功（200 OK）
- [ ] Stripe Webhook エンドポイントが登録されている
- [ ] Netlifyに全ての必須環境変数が設定されている
- [ ] トラッキングリンクからの訪問が記録される

### ✅ 理想的な状態

- [ ] LINE友達追加でコンバージョンが記録される（agency_conversions）
- [ ] Stripe決済でコンバージョンが記録される（テスト決済実施後）
- [ ] Netlify Function Logsでイベント受信が確認できる
- [ ] ダッシュボードでリアルタイム統計が表示される

---

## 🚨 トラブルシューティング

### 問題1: LINE Webhook Verifyが失敗

**エラー**: `401 Unauthorized`

**原因**:
- `LINE_CHANNEL_SECRET` が間違っている
- Netlifyが再デプロイされていない

**解決**:
```
1. Netlify → Environment variables → LINE_CHANNEL_SECRET
2. 値を確認: 0917a4d9a8422c86990ca5123e273e7c
3. Deploys → Trigger deploy
4. 再度 Verify を実行
```

---

### 問題2: LINEアプリが開かない

**症状**: 「完了」と表示されるが、LINEに遷移しない

**原因**:
- `LINE_OFFICIAL_URL` が設定されていない
- `LINE_OFFICIAL_URL` が無効な値（`@xxx`など）

**解決**:
```
1. Netlify → Environment variables
2. LINE_OFFICIAL_URL = https://lin.ee/FMy4xlx
3. Deploys → Trigger deploy
4. 再度テスト
```

---

### 問題3: Stripe Webhookが401 Unauthorized

**原因**: `STRIPE_WEBHOOK_SECRET` が間違っている

**解決**:
```
1. Stripe Dashboard → Webhooks → エンドポイント
2. Signing secret を Reveal
3. 値をコピー
4. Netlify → Environment variables → STRIPE_WEBHOOK_SECRET
5. 値を更新
6. Deploys → Trigger deploy
```

---

### 問題4: コンバージョンが0件のまま

**原因1**: まだテストしていない
→ STEP 6のテストを実行

**原因2**: Webhookが動作していない
→ 問題1, 2, 3を確認

**原因3**: usersテーブルにレコードがない
→ これは既知の設計上の問題（SYSTEM_VERIFICATION_REPORT.md 参照）
→ 短期的には line_user_id ベースでデータ取得するよう修正が必要

---

## 📊 チェックリスト

作業完了後、以下をチェック:

### 環境変数設定
- [ ] STRIPE_WEBHOOK_SECRET
- [ ] LINE_CHANNEL_SECRET
- [ ] LINE_CHANNEL_ACCESS_TOKEN
- [ ] LINE_OFFICIAL_URL (https://lin.ee/FMy4xlx)
- [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] STRIPE_SECRET_KEY
- [ ] JWT_SECRET

### Webhook設定
- [ ] LINE Webhook URL 設定済み
- [ ] LINE Webhook Verify 成功
- [ ] Stripe Webhook エンドポイント登録済み
- [ ] Stripe Signing secret 確認済み

### テスト実行
- [ ] トラッキングリンクから訪問
- [ ] LINE友達追加を実行
- [ ] LINEアプリが開いた
- [ ] Netlify Logsでイベント確認
- [ ] Supabaseでコンバージョン確認

### ダッシュボード確認
- [ ] ダッシュボードにログイン成功
- [ ] 訪問データが表示される
- [ ] コンソールエラーがない

---

## 🔄 次回の課題（長期的改善）

### コード修正が必要な項目

1. **usersテーブルとline_usersテーブルの統合**
   - LINE友達追加時にusersテーブルにもレコード作成
   - または agency-billing-stats.js を line_user_id ベースに変更

2. **metadata設定の確認**
   - TaskMate AI本体のStripe決済処理でmetadataを設定
   - agency_id, tracking_code, user_id を含める

3. **エラーハンドリングの改善**
   - より詳細なエラーメッセージ
   - ログ出力の統一

詳細は `SYSTEM_VERIFICATION_REPORT.md` を参照。

---

## 📞 サポート

問題が解決しない場合:

1. **Netlify Function Logs** のスクリーンショットを確認
2. **Supabase SQL結果** を確認
3. **ブラウザコンソールログ** を確認

これらの情報があれば、さらに詳細な診断が可能です。

---

**作成日**: 2025年10月20日
**最終更新**: 2025年10月20日
**推定所要時間**: 合計 60分
