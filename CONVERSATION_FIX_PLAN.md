# 🔧 会話履歴処理の完全修正計画

## 📋 問題の概要
現在のシステムは**単一メッセージのみ**を処理し、過去の会話履歴を考慮していない。
これにより、ユーザーの詳細な要求が無視され、期待と異なるコードが生成される。

## 🎯 修正の目標
- 過去30通の会話履歴を完全に読み取る
- ユーザーの要求を正確に理解し、構造化する
- セッションの永続化とクラッシュ耐性の実装
- 修正履歴の管理と追跡

---

## 📊 現状の問題点（詳細）

### 1. イベント単体処理
```typescript
// 現在の問題コード
if (!context) {
  return await startNewConversation(userId, messageText, replyToken)
  // → 過去の会話を無視して新規開始
}
```

### 2. メモリ内セッションのみ
```typescript
let context = sessionStore.get(userId)  // メモリ内のみ
// Supabaseからの取得は修正時のみ
```

### 3. 単純な要件抽出
```typescript
if (allText.includes('A列')) requirements.columns = 'A列'
// → キーワードマッチのみ、文脈理解なし
```

### 4. 会話リセット問題
```typescript
static resetConversation(category: string): ConversationContext {
  return { messages: [] }  // 全履歴削除
}
```

---

## 🚀 実装計画（優先順位順）

## Phase 1: Supabaseへの完全移行 🗄️

### 1.1 データベーススキーマ更新
```sql
-- conversations テーブル作成
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  message_index INTEGER NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, message_index)
);

-- conversation_contexts テーブル作成
CREATE TABLE conversation_contexts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL UNIQUE,
  session_id VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  subcategory VARCHAR(100),
  requirements JSONB NOT NULL DEFAULT '{}',
  extracted_requirements JSONB DEFAULT '{}',
  ready_for_code BOOLEAN DEFAULT FALSE,
  last_generated_code BOOLEAN DEFAULT FALSE,
  is_modifying BOOLEAN DEFAULT FALSE,
  waiting_for_screenshot BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

-- インデックス作成
CREATE INDEX idx_conversations_user_session ON conversations(user_id, session_id);
CREATE INDEX idx_conversations_created ON conversations(created_at DESC);
CREATE INDEX idx_contexts_user ON conversation_contexts(user_id);
CREATE INDEX idx_contexts_expires ON conversation_contexts(expires_at);
```

### 1.2 新しいSessionStore実装
```typescript
// lib/conversation/supabase-session-store.ts
import { createClient } from '@supabase/supabase-js'

export class SupabaseSessionStore {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  async getFullConversation(userId: string): Promise<ConversationContext | null> {
    // 1. コンテキスト取得
    const { data: context } = await this.supabase
      .from('conversation_contexts')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (!context) return null

    // 2. 会話履歴取得（最新30件）
    const { data: messages } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('session_id', context.session_id)
      .order('message_index', { ascending: true })
      .limit(30)

    return {
      category: context.category,
      subcategory: context.subcategory,
      messages: messages || [],
      requirements: context.requirements,
      extractedRequirements: context.extracted_requirements,
      readyForCode: context.ready_for_code,
      lastGeneratedCode: context.last_generated_code
    }
  }

  async saveMessage(
    userId: string, 
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: any
  ): Promise<void> {
    // 最新のメッセージインデックスを取得
    const { data: lastMessage } = await this.supabase
      .from('conversations')
      .select('message_index')
      .eq('session_id', sessionId)
      .order('message_index', { ascending: false })
      .limit(1)
      .single()

    const nextIndex = (lastMessage?.message_index || -1) + 1

    await this.supabase
      .from('conversations')
      .insert({
        user_id: userId,
        session_id: sessionId,
        message_index: nextIndex,
        role,
        content,
        metadata
      })
  }

  async updateContext(userId: string, updates: Partial<ConversationContext>): Promise<void> {
    await this.supabase
      .from('conversation_contexts')
      .upsert({
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString()
      })
  }
}
```

---

## Phase 2: LINE会話履歴の取得 💬

### 2.1 過去メッセージ取得機能
```typescript
// lib/line/conversation-history.ts
export class LineConversationHistory {
  private messageCache = new Map<string, Message[]>()

  async getRecentMessages(
    userId: string, 
    limit: number = 30
  ): Promise<Message[]> {
    // Supabaseから過去のメッセージを取得
    const { data: messages } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    return messages?.reverse() || []
  }

  async buildContextFromHistory(
    userId: string,
    currentMessage: string
  ): Promise<string> {
    const history = await this.getRecentMessages(userId)
    
    // 会話履歴を構築
    const contextMessages = history.map(msg => 
      `${msg.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${msg.content}`
    ).join('\n')

    return `【過去の会話履歴】\n${contextMessages}\n\n【現在のメッセージ】\n${currentMessage}`
  }
}
```

### 2.2 webhook/route.ts の修正
```typescript
async function processTextMessage(event: any, requestId: string): Promise<boolean> {
  const userId = event.source?.userId
  const messageText = event.message?.text?.trim() || ''
  const replyToken = event.replyToken

  // 1. Supabaseから完全なコンテキストを取得
  const sessionStore = new SupabaseSessionStore()
  let context = await sessionStore.getFullConversation(userId)

  // 2. 過去の会話履歴を含めて処理
  if (!context) {
    // 新規会話でも過去の履歴を確認
    const history = await new LineConversationHistory().getRecentMessages(userId, 5)
    if (history.length > 0) {
      // 過去の会話がある場合は継続として扱う
      context = await recoverContextFromHistory(userId, history)
    }
  }

  // 3. メッセージを保存
  await sessionStore.saveMessage(
    userId,
    context?.sessionId || generateUUID(),
    'user',
    messageText,
    { timestamp: event.timestamp }
  )

  // 以下、既存の処理...
}
```

---

## Phase 3: AI要件抽出の強化 🤖

### 3.1 高度な要件抽出システム
```typescript
// lib/ai/requirement-extractor.ts
export class AIRequirementExtractor {
  async extractStructuredRequirements(
    conversation: Message[],
    currentMessage: string
  ): Promise<ExtractedRequirements> {
    const prompt = `
過去の会話履歴とユーザーの最新メッセージから、GASコード生成に必要な要件を構造化してください。

【過去の会話】
${conversation.map(m => `${m.role}: ${m.content}`).join('\n')}

【最新メッセージ】
${currentMessage}

以下のJSON形式で要件を抽出してください：
{
  "purpose": "主な目的",
  "frequency": "実行頻度（毎日/毎週/毎月/手動）",
  "trigger": "実行トリガー（時刻/イベント）",
  "dataSource": "データソース（シート名、範囲）",
  "dataTarget": "出力先",
  "operations": ["処理内容のリスト"],
  "conditions": ["条件のリスト"],
  "errorHandling": "エラー処理方法",
  "specialRequirements": ["特別な要求"],
  "userPreferences": {
    "logDetail": "ログの詳細度",
    "notifications": "通知設定",
    "language": "コメント言語"
  }
}
`

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      temperature: 0.3,
      system: 'あなたは要件分析の専門家です。会話から正確に要件を抽出してJSON形式で返してください。',
      messages: [{ role: 'user', content: prompt }]
    })

    try {
      return JSON.parse(response.content[0].text)
    } catch {
      // パースエラー時のフォールバック
      return this.extractBasicRequirements(conversation, currentMessage)
    }
  }

  private extractBasicRequirements(
    conversation: Message[],
    currentMessage: string
  ): ExtractedRequirements {
    // 既存の単純な抽出ロジック（フォールバック用）
    const allText = [...conversation.map(m => m.content), currentMessage].join(' ')
    return {
      purpose: this.extractPurpose(allText),
      frequency: this.extractFrequency(allText),
      // ...
    }
  }
}
```

---

## Phase 4: セッション永続化とクラッシュ耐性 💾

### 4.1 セッション復旧システム
```typescript
// lib/conversation/session-recovery.ts
export class SessionRecovery {
  async recoverSession(userId: string): Promise<ConversationContext | null> {
    // 1. Supabaseから最新セッション取得
    const { data: context } = await supabase
      .from('conversation_contexts')
      .select('*')
      .eq('user_id', userId)
      .gte('expires_at', new Date().toISOString())
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (!context) return null

    // 2. 会話履歴を復元
    const { data: messages } = await supabase
      .from('conversations')
      .select('*')
      .eq('session_id', context.session_id)
      .order('message_index', { ascending: true })

    // 3. 完全なコンテキストを再構築
    return {
      sessionId: context.session_id,
      category: context.category,
      subcategory: context.subcategory,
      messages: messages || [],
      requirements: context.requirements,
      extractedRequirements: context.extracted_requirements,
      readyForCode: context.ready_for_code,
      lastGeneratedCode: context.last_generated_code,
      isModifying: context.is_modifying,
      waitingForScreenshot: context.waiting_for_screenshot
    }
  }

  async createCheckpoint(userId: string, context: ConversationContext): Promise<void> {
    // 定期的にチェックポイントを作成
    await supabase
      .from('session_checkpoints')
      .insert({
        user_id: userId,
        session_id: context.sessionId,
        context_snapshot: JSON.stringify(context),
        created_at: new Date().toISOString()
      })
  }
}
```

---

## Phase 5: 修正履歴管理 📝

### 5.1 コード生成履歴の追跡
```typescript
// lib/code/revision-manager.ts
export class RevisionManager {
  async saveCodeRevision(
    userId: string,
    sessionId: string,
    code: string,
    requirements: any,
    parentRevisionId?: string
  ): Promise<string> {
    const { data: revision } = await supabase
      .from('code_revisions')
      .insert({
        user_id: userId,
        session_id: sessionId,
        code: code,
        requirements: requirements,
        parent_revision_id: parentRevisionId,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    return revision.id
  }

  async getRevisionHistory(sessionId: string): Promise<CodeRevision[]> {
    const { data: revisions } = await supabase
      .from('code_revisions')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    return revisions || []
  }

  async compareRevisions(revisionId1: string, revisionId2: string): Promise<DiffResult> {
    // 2つのリビジョンを比較
    const [rev1, rev2] = await Promise.all([
      this.getRevision(revisionId1),
      this.getRevision(revisionId2)
    ])

    return {
      added: this.findAddedLines(rev1.code, rev2.code),
      removed: this.findRemovedLines(rev1.code, rev2.code),
      modified: this.findModifiedLines(rev1.code, rev2.code)
    }
  }
}
```

---

## 🎯 実装の優先順位

1. **Phase 1**: Supabaseへの完全移行（2日）
   - データベーススキーマ作成
   - SessionStore実装
   - 既存コードの移行

2. **Phase 2**: LINE会話履歴の取得（1日）
   - ConversationHistory実装
   - webhook統合

3. **Phase 3**: AI要件抽出の強化（1日）
   - RequirementExtractor実装
   - Claude API統合

4. **Phase 4**: セッション永続化（1日）
   - SessionRecovery実装
   - チェックポイント機能

5. **Phase 5**: 修正履歴管理（1日）
   - RevisionManager実装
   - 差分表示機能

---

## 📊 期待される効果

- ✅ 過去30通の会話を完全に理解
- ✅ ユーザーの詳細な要求を正確に反映
- ✅ サーバー再起動後もセッション継続
- ✅ 修正履歴の追跡と比較
- ✅ 99.9%の要求理解精度

## 🚨 注意事項

- Supabaseの料金プランを確認
- Claude APIの使用量増加に注意
- データベースのバックアップを定期実行
- プライバシーポリシーの更新が必要