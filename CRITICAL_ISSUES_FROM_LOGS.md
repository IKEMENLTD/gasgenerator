# 🚨 ログから発見された重大な問題

## 実装日: 2025-10-17
## 発見元: Renderログ分析

---

## ❌ **問題1: データベースエラー（最優先修正）**

### エラーログ
```json
{
  "timestamp": "2025-10-17T07:28:31.523Z",
  "level": "error",
  "message": "Failed to update context",
  "context": {
    "userId": "[REDACTED]",
    "error": {
      "code": "42P10",
      "details": null,
      "hint": null,
      "message": "there is no unique or exclusion constraint matching the ON CONFLICT specification"
    }
  }
}
```

### 問題の深刻度
🔴 **CRITICAL** - ユーザーの会話コンテキストが保存されない

### 原因
PostgreSQLエラーコード `42P10`:
- `ON CONFLICT` で指定された一意制約が存在しない
- `conversation_sessions` テーブルの UPSERT 処理が失敗

### 影響範囲
- ✅ コード生成自体は動作する
- ❌ 会話の継続性が失われる
- ❌ セッション情報がSupabaseに保存されない
- ❌ 過去の会話を参照できない

### 修正方法

#### ステップ1: テーブル制約を確認
```sql
-- Supabase SQL Editorで実行
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'conversation_sessions'::regclass;
```

#### ステップ2: 不足している制約を追加
```sql
-- conversation_sessions テーブルに一意制約追加
ALTER TABLE conversation_sessions
ADD CONSTRAINT conversation_sessions_user_id_key
UNIQUE (user_id, id);

-- または、user_idのみで一意にする場合
ALTER TABLE conversation_sessions
ADD CONSTRAINT conversation_sessions_user_id_unique
UNIQUE (user_id);
```

#### ステップ3: コードを修正
**ファイル**: `lib/conversation/supabase-session-store.ts`

```typescript
// 修正前（エラーの原因）
async save(userId: string, session: ConversationSession): Promise<void> {
  await supabaseAdmin
    .from('conversation_sessions')
    .upsert({
      user_id: userId,
      ...session
    }, {
      onConflict: 'user_id' // ❌ この制約が存在しない
    })
}

// 修正後
async save(userId: string, session: ConversationSession): Promise<void> {
  // まず既存セッションを検索
  const { data: existing } = await supabaseAdmin
    .from('conversation_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (existing) {
    // 更新
    await supabaseAdmin
      .from('conversation_sessions')
      .update({
        ...session,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
  } else {
    // 新規作成
    await supabaseAdmin
      .from('conversation_sessions')
      .insert({
        user_id: userId,
        ...session
      })
  }
}
```

---

## ⚠️ **問題2: スパム検出の誤判定（中優先）**

### エラーログ
```json
{
  "timestamp": "2025-10-17T07:28:37.334Z",
  "level": "warn",
  "message": "Spam detected",
  "context": {
    "userId": "[REDACTED]",
    "messageText": "https://docs.google.com/spreadsheets/d/1O_qrhfmrbs0Hwue4lJ8FcZfcBwU4Unph3gB1ghKqk70/edit?gid=1663916"
  }
}
```

### 問題の深刻度
🟡 **HIGH** - 正当なユーザーリクエストがブロックされる

### 原因
スプレッドシートURLが長いため、スパムと誤判定されている

### 影響範囲
- ❌ Googleスプレッドシート連携が失敗
- ❌ ユーザーが要件を説明できない
- ❌ サービスの主要機能が使えない

### 現在のスパム検出ロジック（推測）
```typescript
// lib/middleware/spam-detector.ts（現状）
export function isSpam(text: string): boolean {
  // URLが含まれる長文をスパム判定？
  if (text.length > 200 && /https?:\/\//.test(text)) {
    return true  // ❌ 誤判定の原因
  }
  return false
}
```

### 修正方法

**ファイル**: `lib/middleware/spam-detector.ts`（新規作成または修正）

```typescript
// 修正後: ホワイトリスト方式
export function isSpam(text: string): boolean {
  // 許可するドメイン（Googleサービス）
  const whitelistedDomains = [
    'docs.google.com',
    'drive.google.com',
    'sheets.google.com',
    'gmail.com',
    'calendar.google.com',
    'script.google.com'
  ]

  // ホワイトリストドメインは除外
  const urls = text.match(/https?:\/\/[^\s]+/g) || []
  const allowedUrls = urls.filter(url =>
    whitelistedDomains.some(domain => url.includes(domain))
  )

  // 許可されたURLがある場合はスパムではない
  if (allowedUrls.length > 0) {
    return false
  }

  // 真のスパム判定ロジック
  const spamPatterns = [
    /(.)\1{10,}/,  // 同じ文字の10回以上連続
    /https?:\/\/[^\s]{100,}/,  // 100文字以上の超長いURL（Google除く）
    /\b(viagra|casino|lottery)\b/i,  // スパムキーワード
    /[^\x00-\x7F]{500,}/  // 非ASCII文字が500文字以上
  ]

  return spamPatterns.some(pattern => pattern.test(text))
}
```

### 適用箇所
**ファイル**: `app/api/webhook/route.ts`

```typescript
// 修正前
if (isSpam(messageText)) {
  logger.warn('Spam detected', { userId, messageText: messageText.substring(0, 100) })
  return  // ❌ ここで処理が止まる
}

// 修正後
if (isSpam(messageText)) {
  // Googleドメインはホワイトリストで除外されるので、ここには来ない
  logger.warn('Spam detected', { userId, messageText: messageText.substring(0, 100) })

  await lineClient.replyMessage(replyToken, [{
    type: 'text',
    text: '⚠️ 不適切なメッセージが検出されました。\n\n正常なリクエストの場合は、エンジニアに相談してください。'
  }])
  return
}
```

---

## 🔥 **問題3: メモリ不足（高優先）**

### エラーログ
```json
{
  "timestamp": "2025-10-17T07:28:39.819Z",
  "level": "warn",
  "message": "High memory usage detected",
  "context": {
    "heapUsageRatio": 93,
    "stats": {
      "heapUsed": 50428576,
      "heapTotal": 54345728,
      "external": 4374818,
      "rss": 114888704,
      "arrayBuffers": 549959
    }
  }
}
```

### 問題の深刻度
🟠 **MEDIUM** - パフォーマンス低下、クラッシュリスク

### 原因
- ヒープ使用率93%（危険水準は85%以上）
- 30秒ごとに緊急クリーンアップが実行
- メモリリークの可能性

### ヒープ使用状況
```
heapUsed:  50.4 MB  (使用中)
heapTotal: 54.3 MB  (割り当て済み)
使用率:    93%      (危険！)
```

### 影響範囲
- ⚠️ レスポンス速度低下
- ⚠️ Out of Memory エラーのリスク
- ⚠️ プロセスクラッシュの可能性

### メモリリークの原因（推測）

#### 1. セッションストアのメモリ肥大化
```typescript
// lib/conversation/session-store.ts
class SessionStore {
  private sessions = new Map<string, ConversationSession>()

  // ❌ 古いセッションが削除されず、無限に蓄積
  async get(userId: string): Promise<ConversationSession | null> {
    return this.sessions.get(userId) || null
  }

  async set(userId: string, session: ConversationSession): Promise<void> {
    this.sessions.set(userId, session)  // 削除されない
  }
}
```

#### 2. Claude API レスポンスの保持
```typescript
// lib/claude/client.ts
// ❌ 大きなレスポンスがメモリに残る
const allResponses: string[] = []  // グローバル変数

async generateCode(prompt: string): Promise<string> {
  const response = await claude.messages.create({...})
  allResponses.push(response.content[0].text)  // メモリリーク
  return response.content[0].text
}
```

### 修正方法

#### 修正1: セッションストアのTTL実装

**ファイル**: `lib/conversation/session-store.ts`

```typescript
interface SessionEntry {
  session: ConversationSession
  lastAccess: number
  expiresAt: number
}

export class SessionStore {
  private sessions = new Map<string, SessionEntry>()
  private readonly TTL = 30 * 60 * 1000  // 30分
  private readonly MAX_SIZE = 1000  // 最大1000セッション

  constructor() {
    // 5分ごとにクリーンアップ
    setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  async get(userId: string): Promise<ConversationSession | null> {
    const entry = this.sessions.get(userId)

    if (!entry) return null

    // 期限切れチェック
    if (Date.now() > entry.expiresAt) {
      this.sessions.delete(userId)
      return null
    }

    // アクセス時刻を更新
    entry.lastAccess = Date.now()
    return entry.session
  }

  async set(userId: string, session: ConversationSession): Promise<void> {
    // サイズ制限チェック
    if (this.sessions.size >= this.MAX_SIZE) {
      await this.evictOldest()
    }

    this.sessions.set(userId, {
      session,
      lastAccess: Date.now(),
      expiresAt: Date.now() + this.TTL
    })
  }

  private cleanup(): void {
    const now = Date.now()
    let deletedCount = 0

    for (const [userId, entry] of this.sessions.entries()) {
      if (now > entry.expiresAt) {
        this.sessions.delete(userId)
        deletedCount++
      }
    }

    logger.info('Session cleanup completed', { deletedCount, remainingSize: this.sessions.size })
  }

  private async evictOldest(): Promise<void> {
    // 最もアクセスが古いエントリを削除
    let oldestUserId: string | null = null
    let oldestTime = Date.now()

    for (const [userId, entry] of this.sessions.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess
        oldestUserId = userId
      }
    }

    if (oldestUserId) {
      this.sessions.delete(oldestUserId)
      logger.warn('Evicted oldest session due to size limit', { userId: oldestUserId })
    }
  }

  // メモリ統計
  getStats() {
    return {
      size: this.sessions.size,
      maxSize: this.MAX_SIZE,
      utilizationPercent: (this.sessions.size / this.MAX_SIZE) * 100
    }
  }
}
```

#### 修正2: メモリ監視の改善

**ファイル**: `lib/monitoring/memory-monitor.ts`（新規作成）

```typescript
import { logger } from '../utils/logger'

export class MemoryMonitor {
  private static readonly WARNING_THRESHOLD = 0.8  // 80%
  private static readonly CRITICAL_THRESHOLD = 0.9  // 90%
  private static readonly CHECK_INTERVAL = 30000  // 30秒

  static start() {
    setInterval(() => this.check(), this.CHECK_INTERVAL)
  }

  static check() {
    const usage = process.memoryUsage()
    const heapUsageRatio = usage.heapUsed / usage.heapTotal

    if (heapUsageRatio > this.CRITICAL_THRESHOLD) {
      logger.error('CRITICAL memory usage', {
        heapUsageRatio,
        stats: usage,
        action: 'forcing_gc'
      })

      // 強制ガベージコレクション
      if (global.gc) {
        global.gc()
        logger.info('Manual GC triggered')
      }

      // セッションストアをクリア
      this.emergencyCleanup()

    } else if (heapUsageRatio > this.WARNING_THRESHOLD) {
      logger.warn('High memory usage detected', {
        heapUsageRatio,
        stats: usage
      })
    }
  }

  private static emergencyCleanup() {
    // セッションストアの強制クリーンアップ
    const sessionStore = require('../conversation/session-store').sessionStore

    if (sessionStore && typeof sessionStore.cleanup === 'function') {
      sessionStore.cleanup()
      logger.info('Emergency session cleanup executed')
    }
  }

  static getMemoryInfo() {
    const usage = process.memoryUsage()
    return {
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsagePercent: Math.round((usage.heapUsed / usage.heapTotal) * 100),
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`
    }
  }
}

// アプリ起動時に開始
// app/api/webhook/route.ts などで
MemoryMonitor.start()
```

#### 修正3: Renderの設定変更

**ファイル**: `render.yaml`

```yaml
services:
  - type: web
    name: gas-generator
    env: node
    plan: starter  # または standard

    # メモリ増量（重要！）
    envVars:
      - key: NODE_OPTIONS
        value: "--max-old-space-size=512"  # 512MB（現在は256MB？）
```

---

## 📋 **修正の優先順位**

### 🔴 超緊急（今すぐ）
1. ✅ **データベースエラー修正**
   - 会話が保存されない致命的なバグ
   - 所要時間: 15分

### 🟡 高優先（今日中）
2. ✅ **スパム検出の改善**
   - 正当なリクエストがブロックされる
   - 所要時間: 30分

### 🟠 中優先（明日まで）
3. ✅ **メモリ管理の改善**
   - パフォーマンス低下の原因
   - 所要時間: 1時間

---

## 🔧 **即座に適用できる応急処置**

### 1. データベースエラーの回避
```sql
-- Supabase SQL Editorで即実行
ALTER TABLE conversation_sessions
ADD CONSTRAINT conversation_sessions_user_status_unique
UNIQUE (user_id, status);
```

### 2. スパム検出の無効化（一時的）
```typescript
// app/api/webhook/route.ts
// if (isSpam(messageText)) {
//   return  // コメントアウトで無効化
// }
```

### 3. メモリアラート閾値の調整
```typescript
// lib/utils/logger.ts
// WARNING_THRESHOLD を 0.95 に上げる（一時的）
```

---

## ✅ **修正後の確認項目**

- [ ] データベースエラーが消える
- [ ] Googleスプレッドシートリンクが正常処理される
- [ ] メモリ使用率が85%以下に下がる
- [ ] 30秒ごとのクリーンアップが不要になる
- [ ] 会話の継続性が保たれる

---

作成日: 2025-10-17
緊急度: 🔴 CRITICAL
