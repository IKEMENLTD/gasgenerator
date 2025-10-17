# 🔍 課金機能実装 - 検証チェックリスト

## ✅ チェック1: ファイル構造と命名競合

### Netlify Functions
- ✅ **agency-billing-stats.js** が作成されている
- ✅ 既存の **agency-stats.js** と競合していない（別の機能）
- ✅ JavaScriptシンタックスエラーなし

### フロントエンドファイル
- ✅ **agency/index.html** に「課金状況」タブが追加されている
- ✅ **agency/dashboard.js** に課金情報取得ロジックが追加されている
- ✅ JavaScriptシンタックスエラーなし

---

## ✅ チェック2: データベーススキーマ整合性

### 必須テーブル
- ✅ `agencies` テーブル存在確認
- ✅ `agency_users` テーブル存在確認
- ✅ `agency_conversions` テーブル存在確認
- ✅ `users` テーブル存在確認

### 必須カラム確認

**agency_conversions**:
- ✅ `id` (UUID, PRIMARY KEY)
- ✅ `agency_id` (UUID, FOREIGN KEY → agencies.id)
- ✅ `tracking_link_id` (UUID, FOREIGN KEY → agency_tracking_links.id)
- ⚠️ `user_id` (UUID, FOREIGN KEY → users.id) - **要確認**
- ✅ `conversion_type` (VARCHAR)
- ✅ `line_user_id` (VARCHAR) - LINE IDでの代替連携も可能

**users**:
- ✅ `id` (UUID, PRIMARY KEY)
- ⚠️ `subscription_status` (TEXT) - **要確認**
- ⚠️ `subscription_started_at` (TIMESTAMP) - **要確認**
- ⚠️ `subscription_end_date` (TIMESTAMP) - **要確認**
- ⚠️ `is_premium` (BOOLEAN) - **要確認**
- ⚠️ `stripe_customer_id` (VARCHAR) - **要確認**

### 検証SQL
実行すべきSQL: `database/validate_billing_schema.sql`

---

## ✅ チェック3: API連携整合性

### エンドポイント
- ✅ フロントエンド: `/.netlify/functions/agency-billing-stats`
- ✅ バックエンド: `netlify/functions/agency-billing-stats.js`
- ✅ HTTPメソッド: GET

### 認証ヘッダー
- ✅ `Authorization`: Bearer token
- ✅ `X-Agency-Id`: Agency UUID
- ✅ JWT検証ロジック実装済み
- ✅ Agency ID検証ロジック実装済み

### レスポンス構造

**バックエンド（agency-billing-stats.js）が返すデータ**:
```json
{
  "summary": {
    "activeSubscribers": 0,
    "totalConversions": 0,
    "totalCommission": 0,
    "paidCommission": 0,
    "pendingCommission": 0,
    "commissionRate": 10
  },
  "billingUsers": [
    {
      "userId": "uuid",
      "displayName": "ユーザー名",
      "subscriptionStatus": "active",
      "subscriptionStartedAt": "2024-01-01",
      "subscriptionEndDate": "2025-01-01",
      "isPremium": true,
      "isActive": true,
      "commission": 1000
    }
  ],
  "lastUpdated": "2024-10-17T12:00:00Z"
}
```

**フロントエンド（dashboard.js）の期待データ**:
```javascript
billingStats: {
  summary: { /* 同じ構造 */ },
  billingUsers: [ /* 同じ構造 */ ],
  lastUpdated: null
}
```

✅ **完全一致**

---

## ✅ チェック4: 環境変数

### 必須環境変数
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `JWT_SECRET`

### 確認方法
Netlify Dashboard → Site settings → Environment variables

---

## ✅ チェック5: エラーハンドリング

### バックエンド（agency-billing-stats.js）

**認証エラー**:
- ✅ トークンなし → 401 Unauthorized
- ✅ 無効なトークン → 401 Unauthorized
- ✅ Agency ID不一致 → 403 Forbidden

**データ取得エラー**:
- ✅ Supabase接続エラー → 500 Internal Server Error
- ✅ ユーザーデータなし → 空配列を返す（エラーにしない）
- ✅ コンバージョンデータなし → 空配列を返す（エラーにしない）

**エッジケース**:
- ✅ `userIds.length === 0` の場合の処理
- ✅ `conversions === null` の場合の処理
- ✅ `users === null` の場合の処理
- ✅ 数値計算での `null/undefined` 対策（`|| 0` を使用）

### フロントエンド（dashboard.js）

**API呼び出しエラー**:
- ✅ `try-catch` でエラーハンドリング
- ✅ コンソールにエラーログ出力
- ✅ レスポンスが不正な場合の処理

**エッジケース**:
- ✅ `billingUsers` が空配列の場合 → 「まだ課金ユーザーがいません」メッセージ表示
- ✅ `subscriptionStartedAt` が null の場合 → 「-」表示
- ✅ `subscriptionEndDate` が null + isActive の場合 → 「継続中」表示
- ✅ `commission` が 0 の場合 → 「¥0」表示

---

## ✅ チェック6: コード品質

### 命名規則
- ✅ 関数名: camelCase (`loadBillingStats`)
- ✅ 変数名: camelCase (`billingUsers`, `activeSubscribers`)
- ✅ 定数: UPPER_SNAKE_CASE（環境変数）
- ✅ ファイル名: kebab-case (`agency-billing-stats.js`)

### コメント
- ✅ バックエンド: 日本語コメントで機能説明
- ✅ フロントエンド: 日本語コメントで機能説明

### 一貫性
- ✅ 他のagency関連functionと同じ認証フロー
- ✅ 他のagency関連functionと同じエラーハンドリング
- ✅ 他のagency関連functionと同じCORSヘッダー

---

## ⚠️ 確認が必要な項目

### 1. データベーススキーマ
以下のSQLをSupabaseで実行して確認してください：

```sql
-- database/validate_billing_schema.sql の内容を実行
```

### 2. usersテーブルのカラム確認
`users` テーブルに以下のカラムが存在するか確認：
- `subscription_status`
- `subscription_started_at`
- `subscription_end_date`
- `is_premium`
- `stripe_customer_id`

**もし存在しない場合**:
- LINE IDベースの連携に切り替える
- または、テーブルに必要なカラムを追加する

### 3. agency_conversionsとusersの連携
`agency_conversions.user_id` と `users.id` が正しくリンクされているか確認：

```sql
SELECT
    COUNT(DISTINCT ac.user_id) as total_conversions_with_user_id,
    COUNT(DISTINCT u.id) as linked_users
FROM agency_conversions ac
LEFT JOIN users u ON ac.user_id = u.id
WHERE ac.agency_id = 'YOUR_AGENCY_ID';
```

---

## 🚀 デプロイ前の最終チェック

- [ ] 全てのJavaScriptファイルが構文エラーなし
- [ ] 環境変数がNetlifyに設定されている
- [ ] Supabaseでスキーマ検証SQLを実行済み
- [ ] ローカルで構文チェック完了
- [ ] Git commitメッセージを作成
- [ ] デプロイ準備完了

---

## 📊 動作確認手順（デプロイ後）

### 1. 基本動作確認
1. https://test-taskmate.netlify.app/agency/ にアクセス
2. `account1@test-agency.com` / `Kx9mP#2nQ@7z` でログイン
3. 「課金状況」タブをクリック
4. サマリーカードが表示されることを確認

### 2. データ表示確認
- [ ] 現在の課金中ユーザー数が表示される
- [ ] 総コンバージョン数が表示される
- [ ] 累計報酬額が表示される
- [ ] 個別ユーザーテーブルが表示される

### 3. 自動更新確認
- [ ] タブを開いたまま30秒待つ
- [ ] 「最終更新」の時刻が自動で更新される
- [ ] ブラウザのコンソールにエラーがない

### 4. 手動更新確認
- [ ] 「更新」ボタンをクリック
- [ ] 即座にデータが再取得される
- [ ] 最終更新時刻が更新される

### 5. エラーハンドリング確認
- [ ] ログアウトして再ログイン → 自動更新が正しく停止・再開
- [ ] 他のタブに移動 → 自動更新が停止
- [ ] 課金状況タブに戻る → 自動更新が再開

---

## 🐛 既知の制限事項・注意点

1. **報酬額の計算**:
   - 月額980円 × 課金月数 × 手数料率 で算出
   - 実際の課金額とは異なる可能性がある（試用期間、割引など）

2. **リアルタイム性**:
   - 30秒ごとの更新（完全リアルタイムではない）
   - WebSocketを使えば秒単位の更新も可能

3. **パフォーマンス**:
   - ユーザー数が多い場合、レスポンスに時間がかかる可能性
   - ページネーション未実装

4. **データ連携**:
   - `agency_conversions.user_id` と `users.id` の連携が前提
   - LINE IDベースの連携も可能だが、実装追加が必要

---

## 📝 次回の改善提案

1. **ページネーション**: ユーザー数が増えた場合に対応
2. **フィルタリング**: ステータス別、期間別のフィルター
3. **エクスポート機能**: CSV/Excelダウンロード
4. **グラフ表示**: 課金推移をグラフで可視化
5. **通知機能**: 新規課金ユーザーの通知
6. **詳細ページ**: 個別ユーザーの詳細情報ページ

---

**作成日**: 2024-10-17
**最終更新**: 2024-10-17
