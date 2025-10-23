# TaskMate AI - Render側 システム設計書

**最終更新:** 2024-10-23
**バージョン:** 2.0
**対象:** Render (Next.js アプリケーション)

---

## 目次

1. [Render側システム概要](#1-render側システム概要)
2. [技術スタック](#2-技術スタック)
3. [ディレクトリ構成](#3-ディレクトリ構成)
4. [API エンドポイント詳細](#4-apiエンドポイント詳細)
5. [主要機能の実装](#5-主要機能の実装)
6. [データベース連携](#6-データベース連携)
7. [外部API連携](#7-外部api連携)
8. [環境変数](#8-環境変数)
9. [デプロイ手順](#9-デプロイ手順)
10. [トラブルシューティング](#10-トラブルシューティング)

---

## 1. Render側システム概要

### 1.1 役割

**TaskMate AI のメインアプリケーション**

Render は Next.js 14 (App Router) で構築された TaskMate AI の中核を担当します。

**主な責務:**
- LINE Bot のメッセージ処理
- Claude AI によるコード生成
- Stripe 決済処理
- ユーザー・セッション管理
- プレミアムプラン判定

**Netlify との関係:**
```
LINE API → Netlify Functions → Render (このアプリ)
                                 ↓
                           メイン処理実行
```

Netlify Functions が LINE Webhook を受信し、Render に転送する形。

---

### 1.2 システム構成

```
┌─────────────────────────────────────────────────────────┐
│                  Render Web Service                      │
│                  (Next.js 14 App Router)                 │
│                                                          │
│  Port: 3000 (内部)                                       │
│  URL: https://gasgenerator.onrender.com                 │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ API Routes                                     │    │
│  │ - /api/webhook        (LINE メッセージ処理)   │    │
│  │ - /api/stripe/webhook (Stripe イベント処理)   │    │
│  │ - /api/health         (ヘルスチェック)         │    │
│  │ - /api/admin/*        (管理API)                │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Business Logic (lib/)                          │    │
│  │ - LINE API Client                              │    │
│  │ - Claude AI Client                             │    │
│  │ - Supabase Queries                             │    │
│  │ - Session Manager                              │    │
│  │ - Premium Checker                              │    │
│  │ - Rate Limiter                                 │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
             ↓                    ↓                ↓
    ┌────────────┐      ┌─────────────┐  ┌──────────────┐
    │ Supabase   │      │ Claude API  │  │ Stripe API   │
    │ PostgreSQL │      │ (Anthropic) │  │              │
    └────────────┘      └─────────────┘  └──────────────┘
```

---

## 2. 技術スタック

| 技術 | バージョン | 用途 |
|------|-----------|------|
| **Next.js** | 14.x | React フレームワーク (App Router) |
| **React** | 18.x | UI ライブラリ |
| **TypeScript** | 5.x | 型安全な開発 |
| **Node.js** | 20.x | ランタイム |
| **Supabase JS** | 2.x | PostgreSQL クライアント |
| **@anthropic-ai/sdk** | 0.x | Claude API クライアント |
| **stripe** | 14.x | 決済処理 |

**パッケージマネージャー:** npm

---

## 3. ディレクトリ構成

```
gas-generator/
├── app/
│   ├── api/
│   │   ├── webhook/
│   │   │   └── route.ts              # LINE Webhook メイン処理
│   │   ├── stripe/
│   │   │   └── webhook/
│   │   │       └── route.ts          # Stripe Webhook 処理
│   │   ├── health/
│   │   │   └── route.ts              # ヘルスチェック API
│   │   └── admin/
│   │       └── tracking-links/
│   │           └── route.ts          # トラッキングリンク管理
│   ├── page.tsx                      # ランディングページ
│   ├── layout.tsx                    # ルートレイアウト
│   └── globals.css                   # グローバルスタイル
│
├── lib/
│   ├── line/
│   │   ├── client.ts                 # LINE API クライアント
│   │   ├── message-templates.ts      # メッセージテンプレート
│   │   ├── flex-templates.ts         # Flex Message テンプレート
│   │   ├── flex-code-template.ts     # コード表示用 Flex
│   │   ├── engineer-support.ts       # エンジニアサポート機能
│   │   ├── image-handler.ts          # 画像処理
│   │   ├── webhook-validator.ts      # Webhook 署名検証
│   │   └── message-formatter.ts      # メッセージ整形
│   │
│   ├── claude/
│   │   └── client.ts                 # Claude API クライアント
│   │
│   ├── supabase/
│   │   ├── queries.ts                # データベースクエリ
│   │   └── transaction.ts            # トランザクション処理
│   │
│   ├── conversation/
│   │   ├── conversational-flow.ts    # 会話フロー管理
│   │   ├── session-manager.ts        # セッション管理
│   │   ├── category-detector.ts      # カテゴリ検出
│   │   └── category-definitions.ts   # カテゴリ定義
│   │
│   ├── premium/
│   │   ├── premium-checker.ts        # プレミアムユーザー判定
│   │   └── premium-handler.ts        # プレミアム機能処理
│   │
│   ├── middleware/
│   │   ├── rate-limiter.ts           # レート制限
│   │   └── spam-detector.ts          # スパム検出
│   │
│   ├── monitoring/
│   │   ├── memory-monitor.ts         # メモリ監視
│   │   └── error-notifier.ts         # エラー通知
│   │
│   ├── error-recovery/
│   │   └── recovery-manager.ts       # エラー回復処理
│   │
│   ├── queue/
│   │   ├── manager.ts                # キュー管理
│   │   └── processor.ts              # キュー処理
│   │
│   ├── config/
│   │   └── environment.ts            # 環境変数管理
│   │
│   ├── constants/
│   │   └── config.ts                 # 定数定義
│   │
│   └── utils/
│       ├── logger.ts                 # ログ出力
│       └── crypto.ts                 # 暗号化・ID生成
│
├── public/
│   └── assets/                       # 静的アセット
│
├── package.json
├── tsconfig.json
├── next.config.js
└── RENDER_ARCHITECTURE.md            # このファイル
```

---

## 4. APIエンドポイント詳細

### 4.1 LINE Webhook エンドポイント

**エンドポイント:** `POST /api/webhook`

**役割:** LINE からのイベントを処理（Netlify 経由）

#### リクエストヘッダー
```
Content-Type: application/json
x-line-signature: <LINE署名>
x-forwarded-from: netlify  ← 無限ループ防止
```

#### リクエストボディ例
```json
{
  "events": [
    {
      "type": "follow",
      "timestamp": 1698000000000,
      "source": {
        "userId": "U2f9d259e54f2accac12493c1a13cc114"
      },
      "replyToken": "abc123..."
    }
  ],
  "destination": "..."
}
```

#### 処理フロー
1. **無限ループ防止**: `x-forwarded-from: netlify` チェック
2. **署名検証**: LINE からの正規リクエストか確認
3. **重複イベント検出**: メモリキャッシュで同一イベントをスキップ
4. **イベント振り分け**:
   - `follow` → `handleFollowEvent`
   - `message` → `handleMessageEvent`
   - `unfollow` → `handleUnfollowEvent`
   - `image` → `processImageMessage`

#### レスポンス
```json
{
  "status": "ok"
}
```

---

### 4.2 Stripe Webhook エンドポイント

**エンドポイント:** `POST /api/stripe/webhook`

**役割:** Stripe の決済イベントを処理

#### リクエストヘッダー
```
Content-Type: application/json
stripe-signature: <Stripe署名>
```

#### 処理対象イベント
- `checkout.session.completed` - 決済完了
- `customer.subscription.updated` - サブスク更新
- `customer.subscription.deleted` - サブスクキャンセル

#### 決済完了処理フロー
1. **署名検証**: Stripe からの正規リクエストか確認
2. **LINE User ID デコード**: `client_reference_id` を Base64 デコード
3. **プレミアム有効化**:
   ```sql
   UPDATE users SET
     subscription_status = 'premium',
     subscription_end_date = NOW() + INTERVAL '30 days',
     stripe_customer_id = '...',
     stripe_subscription_id = '...'
   WHERE user_id = '...'
   ```
4. **成功通知**: LINE でプレミアム開始メッセージ送信

---

### 4.3 ヘルスチェックエンドポイント

**エンドポイント:** `GET /api/health`

**役割:** システム稼働状態の確認

#### レスポンス例（正常時）
```json
{
  "status": "healthy",
  "timestamp": "2024-10-23T21:30:00.000Z",
  "checks": {
    "database": true,
    "environment": true,
    "lineApi": true
  },
  "environment": {
    "LINE_CHANNEL_ACCESS_TOKEN": "configured",
    "SUPABASE_URL": "configured",
    "ANTHROPIC_API_KEY": "configured"
  }
}
```

#### レスポンス例（異常時）
```json
{
  "status": "unhealthy",
  "timestamp": "2024-10-23T21:30:00.000Z",
  "checks": {
    "database": false,
    "environment": true,
    "lineApi": false
  },
  "details": {
    "databaseError": "Connection timeout",
    "lineApiError": "Invalid API key"
  }
}
```

---

### 4.4 管理APIエンドポイント

**エンドポイント:** `GET /api/admin/tracking-links`

**役割:** トラッキングリンク一覧取得（代理店用）

#### リクエストヘッダー
```
Authorization: Bearer <agency_code>
```

#### レスポンス例
```json
{
  "tracking_links": [
    {
      "id": "...",
      "tracking_code": "TWITTER_AD_001",
      "name": "Twitter広告A",
      "destination_url": "https://lin.ee/4NLfSqH",
      "visit_count": 150,
      "is_active": true,
      "created_at": "2024-10-01T00:00:00Z"
    }
  ]
}
```

---

## 5. 主要機能の実装

### 5.1 友達追加処理 (handleFollowEvent)

**ファイル:** `app/api/webhook/route.ts` (Lines 1327-1453)

#### 処理フロー

```typescript
async function handleFollowEvent(event: any): Promise<void> {
  const userId = event.source?.userId
  if (!userId) return

  logger.info('New follower', { userId })

  try {
    // 1. ユーザー作成・更新
    const user = await UserQueries.createOrUpdate(userId)
    const isNewUser = (user as any)?.isNewUser

    // 2. プレミアム判定
    const isPremium = (user as any)?.subscription_status === 'premium' &&
                     (user as any)?.subscription_end_date &&
                     new Date((user as any).subscription_end_date) > new Date()

    // 3. メッセージ送信分岐
    if (isPremium) {
      // プレミアムユーザー: シンプルなウェルカムメッセージ
      const success = await lineClient.pushMessage(userId, [{
        type: 'text',
        text: '🎉 おかえりなさい！\n\nプレミアムプランご利用中です。\n無制限でGASコードを生成できます。\n\n「スプレッドシート操作」「Gmail自動化」など、作りたいコードのカテゴリを送信してください。'
      }])

      if (!success) {
        throw new Error('Failed to send premium welcome message')
      }

    } else if (isNewUser) {
      // 新規無料ユーザー: 決済ボタン付きウェルカムメッセージ
      const welcomeMessages = MessageTemplates.createWelcomeMessage()

      // LINE User IDをBase64エンコードしてStripeリンクに追加
      const encodedUserId = Buffer.from(userId).toString('base64')

      // Stripeリンクにclient_reference_idを追加
      const updatedMessages = welcomeMessages.map(msg => {
        if (msg.type === 'template' && 'template' in msg && msg.template.type === 'buttons') {
          msg.template.actions = msg.template.actions.map((action: any) => {
            if (action.type === 'uri' && action.uri.includes('stripe.com')) {
              action.uri += `?client_reference_id=${encodedUserId}`
            }
            return action
          })
        }
        return msg
      })

      // メッセージを個別に送信（確実に全て送信されるように）
      for (let i = 0; i < updatedMessages.length; i++) {
        const success = await lineClient.pushMessage(userId, [updatedMessages[i]])

        if (!success) {
          throw new Error(`Failed to send welcome message ${i + 1}/${updatedMessages.length}`)
        }

        // メッセージ間に100ms遅延を入れて順番を保証
        if (i < updatedMessages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

    } else {
      // 既存無料ユーザー（ブロック解除/再追加）: カテゴリ選択のみ
      const success = await lineClient.pushMessage(userId, [{
        type: 'text',
        text: 'おかえりなさい！😊\n\nまたご利用いただきありがとうございます。\n\n作りたいコードのカテゴリを選んでください：',
        quickReply: {
          items: [
            {
              type: 'action',
              action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' }
            },
            {
              type: 'action',
              action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' }
            },
            {
              type: 'action',
              action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' }
            },
            {
              type: 'action',
              action: { type: 'message', label: '🔗 API', text: 'API連携' }
            },
            {
              type: 'action',
              action: { type: 'message', label: '✨ その他', text: 'その他' }
            },
            {
              type: 'action',
              action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' }
            },
            {
              type: 'action',
              action: { type: 'message', label: '📋 メニュー', text: 'メニュー' }
            }
          ]
        }
      }])

      if (!success) {
        throw new Error('Failed to send returning user welcome message')
      }
    }

  } catch (error) {
    logger.error('Failed to send welcome message', {
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}
```

#### データベース操作

**`UserQueries.createOrUpdate(userId)` の内部処理:**

```typescript
// lib/supabase/queries.ts

static async createOrUpdate(userId: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 既存ユーザー検索
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (existingUser) {
    // 既存ユーザー: last_active_at を更新
    const { data, error } = await supabase
      .from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    return { ...data, isNewUser: false }  // ← 重要！
  } else {
    // 新規ユーザー: INSERT
    const { data, error } = await supabase
      .from('users')
      .insert({
        user_id: userId,
        subscription_status: 'free',
        free_tier_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    return { ...data, isNewUser: true }  // ← 重要！
  }
}
```

#### 重要なポイント

1. **`isNewUser` フラグ**: DB に既存レコードがあるか判定（ブロック解除を既存友達として扱う）
2. **`pushMessage` の戻り値チェック**: `false` の場合は例外を投げる（エラー可視化）
3. **メッセージ個別送信**: 3つのメッセージを100msずつ遅延させて確実に配信
4. **プレミアム判定**: `subscription_end_date > NOW()` で有効期限確認

---

### 5.2 メッセージ処理 (handleMessageEvent)

**ファイル:** `app/api/webhook/route.ts` (Lines 950-1200)

#### 処理フロー概要

```
1. レート制限チェック → 短時間の連続メッセージをブロック
2. スパム検出 → 同一メッセージの繰り返しを検出
3. ユーザー情報取得 → プレミアム判定
4. セッション取得 → 会話コンテキストの復元
5. カテゴリ検出 → "スプレッドシート操作" → category_id 変換
6. Claude AI 処理 → コード生成
7. 応答送信 → LINE に返信
8. DB 保存 → conversations, sessions 更新
```

#### コード例（簡略版）

```typescript
async function handleMessageEvent(event: any, requestId: string): Promise<void> {
  const userId = event.source?.userId
  const messageText = event.message?.text
  const replyToken = event.replyToken

  if (!userId || !replyToken) return

  // 1. レート制限チェック
  const isRateLimited = await rateLimiters.message.check(userId)
  if (isRateLimited) {
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: '⏳ 少々お待ちください。\n\n1分に1回までメッセージを送信できます。'
    }])
    return
  }

  // 2. スパム検出
  if (await isSpam(userId, messageText)) {
    logger.warn('Spam detected', { userId, messageText })
    return
  }

  // 3. ユーザー情報取得
  const user = await UserQueries.get(userId)
  if (!user) {
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: 'エラーが発生しました。もう一度友達追加をお願いします。'
    }])
    return
  }

  // 4. プレミアム判定 & 無料プラン制限
  const premiumChecker = new PremiumChecker()
  const isPremium = premiumChecker.isPremium(user)

  if (!isPremium && user.free_tier_count >= 10) {
    await lineClient.replyMessage(replyToken, [{
      type: 'template',
      altText: '無料プランの上限に達しました',
      template: {
        type: 'buttons',
        text: '無料プランの上限（10回）に達しました。\n\nプレミアムプランで無制限に利用できます。',
        actions: [
          {
            type: 'uri',
            label: 'プレミアムプランを見る',
            uri: `https://buy.stripe.com/...?client_reference_id=${Buffer.from(userId).toString('base64')}`
          }
        ]
      }
    }])
    return
  }

  // 5. セッション取得
  const sessionManager = SessionManager.getInstance()
  const session = await sessionManager.getSession(userId)

  // 6. カテゴリ検出
  const categoryDetector = new CategoryDetector()
  const detectedCategory = categoryDetector.detect(messageText)

  // 7. Claude AI 処理
  await lineClient.showLoadingAnimation(userId, 20)  // ローディング表示

  const claudeClient = new ClaudeApiClient()
  const response = await claudeClient.generateCode({
    userMessage: messageText,
    context: session?.context,
    categoryId: detectedCategory?.id
  })

  // 8. 応答送信
  await lineClient.replyMessage(replyToken, [{
    type: 'text',
    text: response.text
  }], userId)

  // 9. DB 保存
  await supabase.from('conversations').insert({
    user_id: userId,
    category_id: detectedCategory?.id,
    message: messageText,
    response: response.text,
    tokens_used: response.tokensUsed
  })

  await sessionManager.updateSession(userId, {
    context: response.newContext,
    category_id: detectedCategory?.id
  })

  // 10. 無料プランカウント更新
  if (!isPremium) {
    await supabase
      .from('users')
      .update({ free_tier_count: user.free_tier_count + 1 })
      .eq('user_id', userId)
  }
}
```

---

### 5.3 画像処理 (processImageMessage)

**ファイル:** `app/api/webhook/route.ts` (Lines 1471-1550)

#### 処理フロー

```typescript
async function processImageMessage(event: any, requestId: string): Promise<boolean> {
  const userId = event.source?.userId
  const messageId = event.message?.id
  const replyToken = event.replyToken

  if (!userId || !messageId || !replyToken) return false

  try {
    // 1. LINE API から画像バイナリ取得
    const imageHandler = new LineImageHandler()
    const imageBuffer = await imageHandler.downloadImage(messageId)

    // 2. Base64 エンコード
    const base64Image = imageBuffer.toString('base64')

    // 3. Claude Vision API で画像解析
    const claudeClient = new ClaudeApiClient()
    const response = await claudeClient.analyzeImage({
      imageData: base64Image,
      prompt: 'この画像を解析して、GASコードを生成するためのヒントを提供してください。'
    })

    // 4. 応答送信
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: response.text
    }])

    // 5. DB 保存
    await supabase.from('conversations').insert({
      user_id: userId,
      message: '[画像]',
      response: response.text,
      tokens_used: response.tokensUsed
    })

    return true
  } catch (error) {
    logger.error('Image processing failed', { userId, messageId, error })
    return false
  }
}
```

---

## 6. データベース連携

### 6.1 使用テーブル一覧

| テーブル名 | 用途 | Render での操作 |
|-----------|------|----------------|
| `users` | ユーザー情報 | SELECT, INSERT, UPDATE |
| `line_profiles` | LINE プロフィール | SELECT（読み取りのみ） |
| `conversations` | 会話履歴 | INSERT |
| `sessions` | セッション | SELECT, INSERT, UPDATE |
| `agency_tracking_links` | トラッキングリンク | SELECT（管理API用） |
| `agency_tracking_visits` | 訪問記録 | SELECT（管理API用） |

---

### 6.2 users テーブル操作

#### スキーマ
```sql
CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  subscription_status TEXT DEFAULT 'free',    -- 'free' | 'premium'
  subscription_end_date TIMESTAMP,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  free_tier_count INTEGER DEFAULT 0,
  last_active_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### よく使うクエリ

**ユーザー作成・更新:**
```typescript
// lib/supabase/queries.ts: UserQueries.createOrUpdate

const { data: existingUser } = await supabase
  .from('users')
  .select('*')
  .eq('user_id', userId)
  .single()

if (existingUser) {
  // UPDATE
  await supabase
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('user_id', userId)
} else {
  // INSERT
  await supabase
    .from('users')
    .insert({
      user_id: userId,
      subscription_status: 'free',
      free_tier_count: 0
    })
}
```

**プレミアム有効化（Stripe決済完了時）:**
```typescript
// app/api/stripe/webhook/route.ts

await supabase
  .from('users')
  .update({
    subscription_status: 'premium',
    subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    updated_at: new Date().toISOString()
  })
  .eq('user_id', userId)
```

**無料プランカウント更新:**
```typescript
await supabase
  .from('users')
  .update({
    free_tier_count: user.free_tier_count + 1,
    updated_at: new Date().toISOString()
  })
  .eq('user_id', userId)
```

---

### 6.3 conversations テーブル操作

#### スキーマ
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  category_id TEXT,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversations_user ON conversations(user_id, created_at DESC);
```

#### INSERT 例
```typescript
await supabase.from('conversations').insert({
  user_id: userId,
  category_id: 'spreadsheet',
  message: 'スプレッドシートの最終行に追記するコードを教えて',
  response: '以下のGASコードで実現できます...',
  tokens_used: 1500
})
```

---

### 6.4 sessions テーブル操作

#### スキーマ
```sql
CREATE TABLE sessions (
  user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  context JSONB,
  category_id TEXT,
  last_message_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### context JSONB 構造
```json
{
  "previous_messages": [
    {"role": "user", "content": "スプレッドシート操作"},
    {"role": "assistant", "content": "どのような操作ですか？"}
  ],
  "current_step": "gathering_requirements",
  "variables": {
    "sheet_name": "シート1",
    "column": "A"
  }
}
```

#### SessionManager の使用例
```typescript
// lib/conversation/session-manager.ts

const sessionManager = SessionManager.getInstance()

// 取得
const session = await sessionManager.getSession(userId)

// 更新
await sessionManager.updateSession(userId, {
  context: newContext,
  category_id: 'spreadsheet'
})

// 削除
await sessionManager.deleteSession(userId)
```

---

## 7. 外部API連携

### 7.1 LINE Messaging API

#### クライアント実装

**ファイル:** `lib/line/client.ts`

```typescript
export class LineApiClient {
  private accessToken: string
  private baseUrl: string

  constructor() {
    this.accessToken = EnvironmentValidator.getRequired('LINE_CHANNEL_ACCESS_TOKEN')
    this.baseUrl = 'https://api.line.me/v2/bot'
  }

  async pushMessage(userId: string, messages: any[]): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/message/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          to: userId,
          messages: messages.slice(0, 5)  // 最大5メッセージ
        }),
        signal: AbortSignal.timeout(5000)  // 5秒タイムアウト
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('LINE push API error', {
          status: response.status,
          error: errorText,
          userId
        })
        return false
      }

      logger.info('LINE push sent successfully', {
        userId,
        messageCount: messages.length
      })

      return true

    } catch (error) {
      logger.error('LINE push failed', {
        error: error instanceof Error ? error.message : String(error),
        userId
      })
      return false
    }
  }

  async replyMessage(replyToken: string, messages: any[], userId?: string): Promise<boolean> {
    // 実装は pushMessage と同様
  }

  async showLoadingAnimation(userId: string, durationSeconds: number = 20): Promise<boolean> {
    try {
      const response = await fetch('https://api.line.me/v2/bot/chat/loading/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          chatId: userId,
          loadingSeconds: Math.min(durationSeconds, 60)  // 最大60秒
        })
      })

      return response.ok
    } catch (error) {
      logger.error('Failed to show loading animation', { error })
      return false
    }
  }
}
```

#### よくあるエラー

| エラーコード | 原因 | 対処法 |
|-------------|------|--------|
| 401 | `LINE_CHANNEL_ACCESS_TOKEN` が無効 | LINE Developers Console でトークン再発行 |
| 400 | メッセージフォーマットエラー | メッセージ構造を確認 |
| 429 | レート制限超過 | リトライ間隔を開ける |
| 500 | LINE サーバーエラー | 自動リトライ（exponential backoff） |

---

### 7.2 Claude AI API

#### クライアント実装

**ファイル:** `lib/claude/client.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk'

export class ClaudeApiClient {
  private client: Anthropic

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    })
  }

  async generateCode(params: {
    userMessage: string
    context?: any
    categoryId?: string
  }): Promise<{ text: string; tokensUsed: number; newContext: any }> {

    const systemPrompt = this.buildSystemPrompt(params.categoryId)
    const messages = this.buildMessages(params.userMessage, params.context)

    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      temperature: 0.7,
      system: systemPrompt,
      messages: messages
    })

    const text = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    return {
      text,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      newContext: this.updateContext(params.context, params.userMessage, text)
    }
  }

  async analyzeImage(params: {
    imageData: string
    prompt: string
  }): Promise<{ text: string; tokensUsed: number }> {

    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: params.imageData
            }
          },
          {
            type: 'text',
            text: params.prompt
          }
        ]
      }]
    })

    const text = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    return {
      text,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens
    }
  }

  private buildSystemPrompt(categoryId?: string): string {
    const basePrompt = `
あなたはGoogle Apps Script (GAS) の専門家です。
ユーザーの要望に応じて、実用的で動作するGASコードを生成してください。

出力形式:
1. コードの説明（日本語）
2. GASコード（コメント付き）
3. 使い方の説明
`

    if (categoryId === 'spreadsheet') {
      return basePrompt + `\n\nスプレッドシート操作に特化したコードを生成してください。`
    } else if (categoryId === 'gmail') {
      return basePrompt + `\n\nGmail自動化に特化したコードを生成してください。`
    }

    return basePrompt
  }

  private buildMessages(userMessage: string, context?: any): any[] {
    const messages: any[] = []

    if (context?.previous_messages) {
      messages.push(...context.previous_messages)
    }

    messages.push({
      role: 'user',
      content: userMessage
    })

    return messages
  }

  private updateContext(oldContext: any, userMessage: string, assistantResponse: string): any {
    const previousMessages = oldContext?.previous_messages || []

    return {
      previous_messages: [
        ...previousMessages.slice(-4),  // 最新4件のみ保持
        { role: 'user', content: userMessage },
        { role: 'assistant', content: assistantResponse }
      ]
    }
  }
}
```

---

### 7.3 Stripe API

#### 決済リンク生成

**LINE User ID の埋め込み:**
```typescript
const encodedUserId = Buffer.from(userId).toString('base64')
const paymentUrl = `https://buy.stripe.com/test_xxxxx?client_reference_id=${encodedUserId}`
```

#### Webhook 処理

**ファイル:** `app/api/stripe/webhook/route.ts`

```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  try {
    // 署名検証
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object)
        break
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    logger.error('Stripe webhook error', { error })
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 })
  }
}

async function handleCheckoutCompleted(session: any) {
  const clientReferenceId = session.client_reference_id

  if (!clientReferenceId) {
    logger.error('No client_reference_id in checkout session')
    return
  }

  // Base64デコード
  const userId = Buffer.from(clientReferenceId, 'base64').toString('utf-8')

  // プレミアム有効化
  await supabase
    .from('users')
    .update({
      subscription_status: 'premium',
      subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)

  // 成功通知
  await lineClient.pushMessage(userId, [{
    type: 'text',
    text: '🎉 プレミアムプランへのアップグレードが完了しました！\n\n無制限でGASコードを生成できます。'
  }])
}
```

---

## 8. 環境変数

### 8.1 必須環境変数

| 変数名 | 用途 | 取得方法 |
|--------|------|---------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE API 認証トークン | LINE Developers Console → Messaging API設定 |
| `LINE_CHANNEL_SECRET` | Webhook 署名検証用 | LINE Developers Console → Basic settings |
| `SUPABASE_URL` | Supabase プロジェクトURL | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 管理権限キー | Supabase Dashboard → Project Settings → API → service_role key |
| `ANTHROPIC_API_KEY` | Claude API キー | Anthropic Console → API Keys |
| `STRIPE_SECRET_KEY` | Stripe シークレットキー | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 署名検証 | Stripe Dashboard → Developers → Webhooks |

### 8.2 推奨環境変数

| 変数名 | 用途 | デフォルト値 | 推奨値 |
|--------|------|------------|--------|
| `NODE_OPTIONS` | Node.js メモリ設定 | なし | `--max-old-space-size=1536` |
| `LOG_LEVEL` | ログレベル | `info` | `info` (本番), `debug` (開発) |

### 8.3 環境変数の設定方法（Render）

```
1. Render Dashboard にアクセス
2. "gasgenerator" サービスを選択
3. 左メニュー "Environment" をクリック
4. "Add Environment Variable" で追加
5. "Save Changes" で保存 → 自動再起動
```

**重要:**
- 環境変数変更後は自動的に再起動される
- シークレットキーは絶対にコミットしない
- `SUPABASE_SERVICE_ROLE_KEY` は以前 `SUPABASE_SERVICE_KEY` という誤った名前だった（修正済み）

---

## 9. デプロイ手順

### 9.1 自動デプロイ設定

**GitHub 連携:**
```
Repository: IKEMENLTD/gasgenerator
Branch: main
Root Directory: /
```

**ビルド設定:**
```
Build Command: npm install && npm run build
Start Command: npm start
```

**環境:**
```
Runtime: Node.js 20
Plan: Standard (2GB RAM, 0.5 CPU)
Region: Oregon (US West)
```

---

### 9.2 デプロイフロー

```
1. GitHub に main ブランチへ push
   ↓
2. Render が自動検知
   ↓
3. ビルド開始
   - npm install（依存関係インストール）
   - npm run build（Next.js ビルド）
   ↓
4. ビルド完了（約3-5分）
   ↓
5. 自動デプロイ
   - 古いコンテナを停止
   - 新しいコンテナを起動
   ↓
6. ヘルスチェック
   - GET /api/health が200を返すか確認
   ↓
7. デプロイ完了
```

---

### 9.3 デプロイ後の確認

#### ヘルスチェック
```bash
curl https://gasgenerator.onrender.com/api/health
```

**期待される応答:**
```json
{
  "status": "healthy",
  "checks": {
    "database": true,
    "environment": true,
    "lineApi": true
  }
}
```

#### LINE Webhook テスト
```bash
# Netlify経由でテスト（実際の友達追加またはメッセージ送信）
```

#### ログ確認
```
1. Render Dashboard → gasgenerator → Logs
2. リアルタイムでログが流れる
3. エラーがないか確認
```

---

### 9.4 ロールバック手順

```
1. Render Dashboard → gasgenerator
2. 右上 "Manual Deploy" → "Deploy commit"
3. 以前の正常だったコミットを選択
4. "Deploy" クリック
```

---

## 10. トラブルシューティング

### 10.1 LINE メッセージが送信されない

#### 症状
- 友達追加してもメッセージが来ない
- エラーログが出ない（サイレント失敗）

#### 原因
`lineClient.pushMessage` が `false` を返すだけで例外を投げない仕様

#### 確認方法
1. Render Logs を開く
2. 以下のログを探す:
   ```
   Failed to send welcome message { userId: '...', error: '...' }
   LINE push API error { status: 401, error: '...' }
   ```

#### よくあるエラーと対処法

**401 Unauthorized:**
```
原因: LINE_CHANNEL_ACCESS_TOKEN が無効
対処: LINE Developers Console でトークン再発行
     Render 環境変数を更新
```

**400 Bad Request:**
```
原因: メッセージフォーマットエラー
対処: メッセージ構造を確認
     Flex Message の JSON 構造をバリデート
```

**429 Too Many Requests:**
```
原因: レート制限超過
対処: メッセージ送信間隔を広げる
     pushMessage の呼び出し頻度を下げる
```

---

### 10.2 Claude AI がタイムアウト

#### 症状
```
Duration: 28000 ms  # 28秒（タイムアウト寸前）
Claude API request timeout
```

#### 原因
- Claude API のレスポンスが遅い
- ネットワーク遅延
- トークン数が多すぎる

#### 対処法

**タイムアウト設定を調整:**
```typescript
// lib/claude/client.ts

const response = await this.client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 2048,  // 4096 → 2048 に削減
  // ...
})
```

**コンテキストを削減:**
```typescript
return {
  previous_messages: [
    ...previousMessages.slice(-2),  // 4件 → 2件に削減
    { role: 'user', content: userMessage },
    { role: 'assistant', content: assistantResponse }
  ]
}
```

---

### 10.3 メモリ不足

#### 症状
```
Memory Usage: 1450 MB  # 上限（1536MB）近い
Heap out of memory
```

#### 原因
- Node.js のデフォルトヒープサイズが小さい
- セッションキャッシュが肥大化

#### 対処法

**NODE_OPTIONS 設定確認:**
```
Render Environment → NODE_OPTIONS = --max-old-space-size=1536
```

**セッションキャッシュのクリーンアップ頻度を上げる:**
```typescript
// lib/conversation/session-manager.ts

private startCleanup() {
  setInterval(() => {
    this.cleanup()
  }, 5 * 60 * 1000)  // 30分 → 5分に短縮
}
```

---

### 10.4 Stripe Webhook が動作しない

#### 症状
決済完了してもプレミアムにならない

#### 確認ポイント

**1. Webhook URL 設定:**
```
Stripe Dashboard → Developers → Webhooks
Endpoint URL: https://gasgenerator.onrender.com/api/stripe/webhook
```

**2. イベント選択:**
```
✅ checkout.session.completed
✅ customer.subscription.updated
✅ customer.subscription.deleted
```

**3. STRIPE_WEBHOOK_SECRET 設定:**
```
Render Environment → STRIPE_WEBHOOK_SECRET = whsec_...
```

**4. 署名検証エラー:**
```
Render Logs で確認:
Stripe webhook error: No signatures found matching the expected signature
```

**対処:**
- `STRIPE_WEBHOOK_SECRET` を Stripe Dashboard から再取得
- Render 環境変数を更新

---

### 10.5 ログ確認方法

#### Render Logs
```
https://dashboard.render.com/
↓
"gasgenerator" をクリック
↓
左メニュー "Logs" をクリック
↓
リアルタイムログが表示される
```

**探すべきキーワード:**
- `New follower` → 友達追加イベント
- `Failed to send` → メッセージ送信エラー
- `LINE push API error` → LINE API エラー
- `Database error` → DB エラー
- `Claude API error` → Claude API エラー
- `Stripe webhook error` → Stripe エラー

---

### 10.6 緊急時の対処

#### 全ユーザーにメッセージ送信不可

**即座の対応:**
1. Render Logs で `LINE_CHANNEL_ACCESS_TOKEN` エラー確認
2. LINE Developers Console でトークン再発行
3. Render Environment でトークン更新
4. Render を手動再起動

---

#### データベース接続エラー

**即座の対応:**
1. Supabase Dashboard でプロジェクト状態確認
2. `SUPABASE_SERVICE_ROLE_KEY` が正しいか確認
3. Supabase の IP 制限設定確認（Render の IP を許可）

**Render の IP 確認方法:**
```bash
# Render Shell で実行
curl ifconfig.me
```

---

## 付録

### A. 主要なコミット履歴

| 日付 | コミット | 内容 |
|------|---------|------|
| 2024-10-23 | `4e387fa` | pushMessage 戻り値チェック追加（サイレント失敗防止） |
| 2024-10-22 | `5496b02` | isNewUser フラグ追加（既存友達スパム防止） |
| 2024-10-21 | `391c69b` | Welcome メッセージ個別送信（3メッセージ確実配信） |

---

### B. 今後の改善案

#### 優先度: 高
1. **エラー通知システム**: Slack/Discord への自動通知
2. **リトライ機構**: LINE API エラー時の自動リトライ
3. **ログ集約**: Datadog/Sentry などの導入

#### 優先度: 中
1. **プレミアムプラン拡張**: 複数プラン対応（月額・年額）
2. **コード実行環境**: GAS コードをサンドボックスで実行
3. **画像生成機能**: コード図解の自動生成

---

### C. 参考リンク

- **LINE Messaging API**: https://developers.line.biz/ja/reference/messaging-api/
- **Anthropic Claude API**: https://docs.anthropic.com/claude/reference/
- **Stripe API**: https://stripe.com/docs/api
- **Supabase JS Client**: https://supabase.com/docs/reference/javascript/introduction
- **Next.js App Router**: https://nextjs.org/docs/app
- **Render Docs**: https://render.com/docs

---

**Render側ドキュメント終了**

このファイルは Render 側システムの完全なリファレンスです。
変更があった場合は、このファイルも合わせて更新してください。
