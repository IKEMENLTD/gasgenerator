# API仕様書 - GAS Generator

## 概要
GAS Generatorが提供するAPIエンドポイントの詳細仕様書です。

## API一覧

### 1. LINE Webhook API
**エンドポイント**: `/api/webhook`  
**メソッド**: POST, GET

#### POST /api/webhook
LINEからのWebhookイベントを受信して処理します。

**Headers**:
- `x-line-signature`: 署名（必須）
- `Content-Type`: application/json

**Request Body**:
```json
{
  "events": [
    {
      "type": "message | follow | unfollow",
      "timestamp": 1234567890000,
      "source": {
        "type": "user | group | room",
        "userId": "U12345678",
        "groupId": "G12345678",
        "roomId": "R12345678"
      },
      "replyToken": "reply-token-string",
      "message": {
        "id": "message-id",
        "type": "text | image | file",
        "text": "メッセージ内容",
        "fileName": "ファイル名"
      }
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "processed": 1,
  "time": 150
}
```

**処理フロー**:
1. 署名検証 (`validateLineSignature`)
2. レート制限チェック
3. 重複イベント検出
4. イベントタイプ別処理
   - テキストメッセージ → 会話処理
   - 画像メッセージ → Vision API解析
   - ファイルメッセージ → ファイル処理
   - フォローイベント → ウェルカムメッセージ
   - アンフォローイベント → セッションクリーンアップ

**特殊コマンド**:
- `グループID確認`: グループIDを返信
- `ユーザーID確認`: ユーザーIDを返信
- `エラーのスクリーンショットを送る`: スクショ待機モード
- `画像を解析`: 画像解析モード
- `エンジニアに相談`: サポートリクエスト
- `使い方`: ヘルプメッセージ
- `プレミアムプラン`: 決済リンク表示

#### GET /api/webhook
ヘルスチェック用エンドポイント

**Response**:
```json
{
  "status": "OK",
  "service": "GAS Generator Webhook",
  "version": "2.0.0",
  "mode": "conversational",
  "features": ["text", "image", "file"],
  "timestamp": "2025-01-09T12:00:00Z"
}
```

---

### 2. Stripe Webhook API
**エンドポイント**: `/api/stripe/webhook`  
**メソッド**: POST

Stripeからの決済イベントを処理します。

**Headers**:
- `stripe-signature`: Stripe署名（必須）

**Request Body**: Stripeイベントオブジェクト

**処理イベント**:
- `checkout.session.completed`: 決済完了
- `customer.subscription.created`: サブスクリプション作成
- `customer.subscription.updated`: サブスクリプション更新
- `customer.subscription.deleted`: サブスクリプションキャンセル
- `invoice.payment_succeeded`: 支払い成功
- `invoice.payment_failed`: 支払い失敗

**処理フロー**:
1. 署名検証
2. イベントID重複チェック（冪等性）
3. イベントタイプ別処理
4. ユーザーステータス更新
5. LINE通知送信

**Response**:
```json
{
  "received": true,
  "eventId": "evt_xxx",
  "processed": true
}
```

---

### 3. Cron API

#### /api/cron/cleanup
**メソッド**: GET  
**認証**: Cron-Secret ヘッダー

期限切れセッションとキューのクリーンアップを実行。

**Headers**:
- `x-cron-secret`: CRONシークレット（必須）

**処理内容**:
- 24時間以上古いセッションを削除
- 1時間以上古い処理済みキューを削除
- 7日以上古いエラーキューを削除
- 30日以上古いStripeイベントを削除

**Response**:
```json
{
  "success": true,
  "cleaned": {
    "sessions": 5,
    "queues": 10,
    "stripeEvents": 3
  }
}
```

#### /api/cron/process-queue
**メソッド**: GET  
**認証**: Cron-Secret ヘッダー

キューに溜まったコード生成タスクを処理。

**Headers**:
- `x-cron-secret`: CRONシークレット（必須）

**処理内容**:
1. 未処理キューを取得（最大5件）
2. Claude APIでコード生成
3. LINE経由で結果送信
4. キューステータス更新

**Response**:
```json
{
  "success": true,
  "processed": 3,
  "errors": 0,
  "details": [
    {
      "id": "queue-id-1",
      "status": "completed",
      "processingTime": 2500
    }
  ]
}
```

---

### 4. Health Check API
**エンドポイント**: `/api/health`  
**メソッド**: GET

システムの健全性チェック。

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-09T12:00:00Z",
  "uptime": 86400,
  "services": {
    "database": "connected",
    "claude": "available",
    "line": "connected",
    "stripe": "configured"
  },
  "metrics": {
    "activeUsers": 150,
    "queueLength": 3,
    "averageResponseTime": 250
  }
}
```

---

### 5. Admin API

#### /api/admin/vision-stats
**メソッド**: GET  
**認証**: Admin-Key ヘッダー

Vision API使用統計を取得。

**Headers**:
- `x-admin-key`: 管理者キー（必須）

**Response**:
```json
{
  "stats": {
    "totalUsage": 1234,
    "dailyUsage": 45,
    "monthlyUsage": 890,
    "topUsers": [
      {
        "userId": "U123",
        "count": 50,
        "lastUsed": "2025-01-09T10:00:00Z"
      }
    ],
    "errorRate": 0.02
  }
}
```

---

## エラーレスポンス

すべてのAPIで共通のエラーフォーマット：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": {},
    "timestamp": "2025-01-09T12:00:00Z"
  }
}
```

### エラーコード一覧

| コード | 説明 | HTTPステータス |
|--------|------|---------------|
| INVALID_SIGNATURE | 署名検証失敗 | 401 |
| RATE_LIMIT_EXCEEDED | レート制限超過 | 429 |
| INVALID_REQUEST | 不正なリクエスト | 400 |
| INTERNAL_ERROR | 内部エラー | 500 |
| SERVICE_UNAVAILABLE | サービス利用不可 | 503 |
| UNAUTHORIZED | 認証失敗 | 401 |
| NOT_FOUND | リソースが見つからない | 404 |
| PAYMENT_REQUIRED | 支払いが必要 | 402 |

---

## レート制限

| エンドポイント | 制限 | ウィンドウ |
|---------------|------|-----------|
| /api/webhook | 100リクエスト | 1分 |
| /api/stripe/webhook | 50リクエスト | 1分 |
| /api/cron/* | 10リクエスト | 1分 |
| /api/admin/* | 30リクエスト | 1分 |
| /api/health | 制限なし | - |

レート制限超過時のレスポンス：
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "retryAfter": 30,
    "limit": 100,
    "remaining": 0,
    "reset": "2025-01-09T12:01:00Z"
  }
}
```

---

## セキュリティ

### 認証方式

1. **LINE Webhook署名**
   - HMAC-SHA256による署名検証
   - Channel Secretを使用

2. **Stripe Webhook署名**
   - Stripe署名検証
   - Webhook Endpointシークレットを使用

3. **Cron認証**
   - カスタムヘッダーによる認証
   - 環境変数でシークレット管理

4. **Admin認証**
   - APIキーによる認証
   - IP制限（オプション）

### セキュリティヘッダー

すべてのレスポンスに以下のヘッダーを含む：
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

---

## 環境変数

APIで使用される環境変数：

```env
# LINE
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PAYMENT_LINK=

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude AI
ANTHROPIC_API_KEY=

# Security
CRON_SECRET=
ADMIN_API_KEY=

# Config
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=
```

---

## デプロイメント

### Render.com設定

```yaml
services:
  - type: web
    name: gas-generator
    env: node
    region: oregon
    plan: starter
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_VERSION
        value: 18.19.0
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
```

### ヘルスチェック設定
- Path: `/api/health`
- Interval: 300秒
- Timeout: 30秒

### Auto-Deploy
- Branch: `main`
- Auto-Deploy: 有効

---

## モニタリング

### メトリクス
- レスポンスタイム
- エラー率
- キュー長
- アクティブユーザー数

### ログ
- アプリケーションログ: `/lib/utils/logger.ts`
- エラー通知: `/lib/monitoring/error-notifier.ts`
- パフォーマンス: `/lib/monitoring/performance-tracker.ts`

### アラート条件
- エラー率 > 5%
- レスポンスタイム > 3秒
- キュー長 > 100
- メモリ使用率 > 90%

---

## バージョン管理

### 現在のバージョン
- API Version: 2.0.0
- Last Updated: 2025-01-09

### 変更履歴
- v2.0.0: 会話型フロー実装
- v1.5.0: Vision API統合
- v1.0.0: 初期リリース

### 下位互換性
- v1.x系のエンドポイントは維持
- 非推奨APIは6ヶ月後に削除

---

## サポート

### ドキュメント
- GitHub: https://github.com/yourusername/gas-generator
- Issues: https://github.com/yourusername/gas-generator/issues

### コンタクト
- Email: support@gas-generator.com
- LINE: @gas-generator

---

*この仕様書は定期的に更新されます。最新版はGitHubリポジトリを参照してください。*