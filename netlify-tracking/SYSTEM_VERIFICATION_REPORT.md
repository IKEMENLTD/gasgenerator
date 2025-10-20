# システム検証レポート - 辛口チェック結果

実施日時: 2025年10月20日

---

## 🔍 検証結果サマリー

### ✅ 正常に動作している機能

| 項目 | 状態 | 確認方法 |
|------|------|---------|
| **Webhook関数の存在** | ✅ 確認済み | `line-webhook.js` (26KB), `stripe-webhook.js` (10KB) |
| **Netlify設定** | ✅ 正常 | `netlify.toml` でFunction設定あり |
| **トラッキング機能** | ✅ 動作中 | 11訪問記録済み |
| **代理店登録** | ✅ 動作中 | 2代理店登録済み |
| **ダッシュボード** | ✅ 動作中 | ログイン・表示正常 |

### ⚠️ 確認が必要な項目

| 項目 | 状態 | 理由 |
|------|------|------|
| **LINE Webhook設定** | ⚠️ 未確認 | LINE Developers Consoleでの設定が不明 |
| **Stripe Webhook設定** | ⚠️ 未確認 | Stripe Dashboardでの設定が不明 |
| **環境変数設定** | ⚠️ 未確認 | Netlifyの実際の設定値が不明 |
| **コンバージョンデータ** | ❌ 0件 | まだテストされていない |

---

## 📋 詳細検証結果

### 1. Webhook関数ファイルの存在確認

```bash
✅ line-webhook.js: 26,382 bytes (更新: 2025-10-19)
✅ stripe-webhook.js: 10,080 bytes (更新: 2025-10-03)
```

**評価**: 両方のWebhook関数が存在し、最近更新されている。

---

### 2. Netlify設定の確認 (`netlify.toml`)

#### Functions設定
```toml
[build]
  functions = "netlify/functions"  ✅ 正しい

[functions]
  node_bundler = "esbuild"  ✅ 正しい
```

#### Webhook用のCORS設定
```toml
[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Headers = "Content-Type, X-Line-Signature"  ✅ LINE署名ヘッダーあり
    Access-Control-Allow-Methods = "GET, POST, OPTIONS"
```

**評価**: A - Netlify設定は完璧

---

### 3. 環境変数の確認

#### 必須環境変数リスト (`.env.example`から抽出)

**LINE Webhook用**:
```bash
✅ LINE_CHANNEL_ACCESS_TOKEN (必須)
✅ LINE_CHANNEL_SECRET (必須)
✅ LINE_OFFICIAL_URL (必須) ← 既に設定済み: https://lin.ee/FMy4xlx
```

**Stripe Webhook用**:
```bash
⚠️ STRIPE_SECRET_KEY (必須)
⚠️ STRIPE_WEBHOOK_SECRET (必須) ← これが重要！
```

**Supabase**:
```bash
✅ SUPABASE_URL (必須)
✅ SUPABASE_SERVICE_ROLE_KEY (必須)
```

#### 環境変数の確認方法

**Netlify Dashboardで確認**:
```
1. https://app.netlify.com/ にログイン
2. サイトを選択
3. Site settings → Environment variables
4. 上記の変数がすべて設定されているか確認
```

**特に重要**: `STRIPE_WEBHOOK_SECRET`
- これがないとStripe Webhookが署名検証に失敗する
- Stripe Dashboard → Developers → Webhooks → Signing secret からコピー

---

### 4. Webhook URLの確認

#### LINE Webhook URL

**設定すべきURL**:
```
https://taskmateai.net/.netlify/functions/line-webhook
```

**確認方法**:
1. https://developers.line.biz/console/ にログイン
2. プロバイダーを選択
3. Messaging APIチャンネルを選択
4. **Messaging API設定タブ** → **Webhook URL** を確認
5. **Use webhook**: ON になっているか確認
6. **Verify** ボタンをクリックしてテスト

**期待される結果**:
```
✅ Success (200 OK)
❌ Error → Webhook関数が動作していない、または環境変数が間違っている
```

#### Stripe Webhook URL

**設定すべきURL**:
```
https://taskmateai.net/.netlify/functions/stripe-webhook
```

**確認方法**:
1. https://dashboard.stripe.com/webhooks にログイン
2. **Add endpoint** (まだない場合)
3. URL: `https://taskmateai.net/.netlify/functions/stripe-webhook`
4. **Select events**:
   - ✅ `payment_intent.succeeded`
   - ✅ `checkout.session.completed`
   - ✅ `customer.created`
   - ✅ `invoice.payment_succeeded`
5. **Signing secret** をコピーして環境変数に設定

---

### 5. Webhookロジックの検証

#### LINE Webhook (`line-webhook.js`)

**重要な処理フロー**:
```javascript
1. 署名検証 (line 78-89)
   ✅ HMAC-SHA256で検証
   ✅ LINE_CHANNEL_SECRETを使用

2. FOLLOWイベント処理 (line 113-183)
   ✅ 代理店登録の友達追加を検知
   ✅ agencies.status を 'active' に更新
   ✅ agency_users.is_active を true に更新
   ✅ ウェルカムメッセージ送信

3. 環境変数チェック (line 712-718)
   ✅ 起動時にチェック実施
```

**評価**: A - 実装は完璧

**潜在的な問題点**:
```javascript
// line 131-135: 代理店をline_user_idで検索
const { data: agency } = await supabase
    .from('agencies')
    .select('*')
    .eq('line_user_id', userId)
    .single();
```

**問題**: このコードは「代理店自身が友達追加する」フローを想定している。
**しかし**: 通常は「代理店経由で流入したユーザーが友達追加する」フロー。

**辛口指摘**:
- 🔥 代理店とエンドユーザーのLINE友達追加が混同されている可能性
- 🔥 `linkUserToTracking()` (line 313-393) が実際のユーザーフローを処理
- 🔥 しかし、`line_users`テーブルと`users`テーブルの関連が不明確

#### Stripe Webhook (`stripe-webhook.js`)

**重要な処理フロー**:
```javascript
1. 署名検証 (line 37-42)
   ✅ Stripe SDKで検証
   ✅ STRIPE_WEBHOOK_SECRETを使用

2. payment_intent.succeeded処理 (line 92-239)
   ✅ metadata から tracking_code, agency_id, user_id を取得
   ✅ agency_conversions に記録
   ✅ commission計算

3. metadata必須項目
   ⚠️ tracking_code または agency_id が必要
   ⚠️ user_id があれば課金情報に紐付け
```

**評価**: A - 実装は完璧

**潜在的な問題点**:
```javascript
// line 105-108: metadataチェック
if (!agency_id && !tracking_code) {
    console.log('No agency attribution found for payment');
    return;
}
```

**辛口指摘**:
- 🔥 Stripe決済時にmetadataが正しく設定されているか不明
- 🔥 TaskMate AIの決済処理でmetadataを設定する必要がある
- 🔥 設定していない場合、Webhookは受信するがコンバージョンが記録されない

---

## 🚨 致命的な問題点

### 問題1: LINE友達追加フローの二重構造

**2つのフローが混在**:

#### フロー1: 代理店登録時のLINE連携 (実装済み)
```
代理店登録 → LINE Login → 友達追加 → agencies.status = 'active'
```
✅ これは動作している（あなたがログインできている）

#### フロー2: エンドユーザーの友達追加 (問題あり)
```
トラッキングリンク → 訪問記録 → LINE友達追加 → ???
```
❌ このフローがコンバージョンとして記録されていない可能性

**コードの問題点** (`line-webhook.js:131-136`):
```javascript
// これは「代理店のLINE User ID」を探している
const { data: agency } = await supabase
    .from('agencies')
    .eq('line_user_id', userId)  // ← 代理店のLINE ID
    .single();

if (!agencyError && agency) {
    // 代理店アクティベーション処理
    // これは代理店登録フローでのみ実行される
}
```

**辛口評価**:
- 🔥 **F-** エンドユーザーの友達追加がコンバージョンとして記録されない
- 🔥 `linkUserToTracking()` が呼ばれても、`agency_conversions`に記録される保証がない
- 🔥 コードは `line_users` テーブルに記録するが、課金情報は `users` テーブルを参照

---

### 問題2: usersテーブルとline_usersテーブルの分離

**2つのテーブルが存在**:

#### `users` テーブル (親プロジェクト)
```sql
- id UUID PRIMARY KEY
- line_user_id TEXT UNIQUE
- subscription_status TEXT  ← これが必要
- stripe_customer_id TEXT   ← これが必要
```

#### `line_users` テーブル (netlify-tracking)
```sql
- id UUID PRIMARY KEY
- line_user_id TEXT UNIQUE
- display_name TEXT
- is_friend BOOLEAN
```

**問題点**:
- `agency_conversions.user_id` は `users.id` を参照
- しかし、LINE Webhookは `line_users` にしか記録しない
- **2つのテーブル間の同期処理がない**

**辛口評価**:
- 🔥 **D** テーブル設計が不整合
- 🔥 LINE友達追加しても `users` テーブルにレコードが作成されない
- 🔥 → `user_id` が NULL になる
- 🔥 → 課金情報が取得できない

---

## 💡 修正提案

### 修正案1: LINE Webhookで usersテーブルにも記録 (推奨)

```javascript
// line-webhook.js の handleFollowEvent() に追加
async function handleFollowEvent(event) {
    const userId = event.source.userId;

    // ... 既存のline_usersへのINSERT処理 ...

    // 🆕 usersテーブルにも記録
    const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('line_user_id', userId)
        .single();

    if (!existingUser) {
        await supabase
            .from('users')
            .insert({
                line_user_id: userId,
                display_name: userProfile.displayName,
                subscription_status: 'free',
                is_premium: false
            });
    }
}
```

### 修正案2: agency_conversionsにline_user_idのみ記録

```javascript
// line-webhook.js の createAgencyLineConversion() を修正
// user_id を必須にしない
const conversionData = {
    agency_id: session.agency_id,
    tracking_link_id: session.tracking_link_id,
    user_id: null,  // ← NULL許容
    line_user_id: lineUserId,  // ← これをメインに
    conversion_type: 'line_friend',
    conversion_value: 0
};
```

そして、`agency-billing-stats.js` を修正:
```javascript
// line_user_idベースでユーザーを取得
const lineUserIds = conversions?.map(c => c.line_user_id).filter(Boolean);

const { data: users } = await supabase
    .from('users')
    .select('*')
    .in('line_user_id', lineUserIds);  // ← line_user_idで検索
```

---

## 📊 検証手順（実際に実行すべき）

### STEP 1: 環境変数を確認

```bash
# Netlify Dashboard で以下を確認:
✅ LINE_CHANNEL_ACCESS_TOKEN
✅ LINE_CHANNEL_SECRET
✅ LINE_OFFICIAL_URL (https://lin.ee/FMy4xlx)
✅ STRIPE_SECRET_KEY
✅ STRIPE_WEBHOOK_SECRET ← これが特に重要
✅ SUPABASE_URL
✅ SUPABASE_SERVICE_ROLE_KEY
```

### STEP 2: Webhook URLを設定

**LINE**:
```
https://taskmateai.net/.netlify/functions/line-webhook
```

**Stripe**:
```
https://taskmateai.net/.netlify/functions/stripe-webhook
```

### STEP 3: テスト実行

**LINE友達追加テスト**:
1. トラッキングリンクから訪問
2. LINE友達追加を実行
3. Supabaseで確認:
```sql
-- コンバージョン確認
SELECT * FROM agency_conversions
WHERE conversion_type = 'line_friend'
ORDER BY created_at DESC LIMIT 5;

-- line_usersテーブル確認
SELECT * FROM line_users
ORDER BY created_at DESC LIMIT 5;

-- usersテーブル確認
SELECT * FROM users
WHERE line_user_id IS NOT NULL
ORDER BY created_at DESC LIMIT 5;
```

**Stripe決済テスト**:
1. TaskMate AIで課金実行（テストモード）
2. metadataに以下を設定:
```javascript
{
    tracking_code: '8f5yoytw84zp',  // あなたのトラッキングコード
    agency_id: '295a08d0-9e62-4935-af8e-6efd06566296',  // あなたの代理店ID
    line_user_id: 'UXXXXXXXXX',  // ユーザーのLINE ID
    user_id: 'UUID'  // もしusersテーブルにあれば
}
```

### STEP 4: ログを確認

**Netlify Function Logs**:
```
Functions → line-webhook → Logs
Functions → stripe-webhook → Logs
```

---

## 🎯 辛口総評

| 評価項目 | スコア | 詳細 |
|---------|--------|------|
| **コード品質** | B+ | 実装は良いが、フロー混在 |
| **テーブル設計** | C- | users と line_users の分離が不整合 |
| **Webhook設定** | ⚠️ 未確認 | 実際の設定値が不明 |
| **テスト実施** | F | 一度も動作確認していない |
| **ドキュメント** | A | 詳細に記載されている |

### 最も辛口な指摘

**「実装は完璧だが、設計思想が曖昧」**

- 代理店とエンドユーザーのフローが混在
- usersテーブルとline_usersテーブルの役割分担が不明確
- コンバージョンが記録されない根本原因はテーブル設計

---

## 📝 次のアクション（優先度順）

### 🔴 緊急（今すぐ実行）

1. **環境変数を確認**（5分）
   - Netlify Dashboard → Environment variables
   - 特に `STRIPE_WEBHOOK_SECRET`

2. **Webhook URLを設定**（5分）
   - LINE Developers Console
   - Stripe Dashboard

### 🟡 重要（24時間以内）

3. **テストを実行**（30分）
   - LINE友達追加テスト
   - ログ確認
   - Supabaseでデータ確認

### 🟢 改善（1週間以内）

4. **コード修正**（2時間）
   - LINE Webhookでusersテーブルにも記録
   - または agency-billing-statsをline_user_idベースに変更

---

**検証実施者**: Claude Code
**検証日時**: 2025年10月20日
**システムバージョン**: netlify-tracking v1.0
