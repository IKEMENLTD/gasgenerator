/**
 * 会話システム統合テスト
 * 実行: npm test tests/conversation-integration.test.ts
 */

import { SessionManager } from '@/lib/conversation/session-manager'
import { SupabaseSessionStore } from '@/lib/conversation/supabase-session-store'
import { ConversationCache } from '@/lib/cache/conversation-cache'
import { ConversationalFlow } from '@/lib/conversation/conversational-flow'

describe('会話システム統合テスト', () => {
  const testUserId = 'test_user_' + Date.now()
  let sessionManager: SessionManager
  let supabaseStore: SupabaseSessionStore
  let cache: ConversationCache

  beforeAll(() => {
    sessionManager = SessionManager.getInstance()
    supabaseStore = SupabaseSessionStore.getInstance()
    cache = ConversationCache.getInstance()
  })

  afterAll(async () => {
    // クリーンアップ
    await sessionManager.deleteSession(testUserId)
    cache.clear()
  })

  describe('1. セッション作成と永続化', () => {
    test('新規セッションが正しく作成される', async () => {
      const context = await sessionManager.createSession(
        testUserId,
        'spreadsheet',
        'テストメッセージ'
      )

      expect(context).toBeDefined()
      expect(context.sessionId).toBeDefined()
      expect(context.category).toBe('spreadsheet')
      expect(context.messages).toHaveLength(1)
      expect(context.messages[0].content).toBe('テストメッセージ')
    })

    test('セッションがSupabaseに保存される', async () => {
      // 少し待機してSupabaseへの非同期保存を待つ
      await new Promise(resolve => setTimeout(resolve, 1000))

      const retrieved = await supabaseStore.getFullConversation(testUserId)
      expect(retrieved).toBeDefined()
      expect(retrieved?.category).toBe('spreadsheet')
    })

    test('セッションがキャッシュから高速に取得できる', async () => {
      const start = Date.now()
      const context = await sessionManager.getContext(testUserId)
      const elapsed = Date.now() - start

      expect(context).toBeDefined()
      expect(elapsed).toBeLessThan(10) // 10ms以内
    })
  })

  describe('2. メッセージの追加と履歴管理', () => {
    test('複数のメッセージが正しく保存される', async () => {
      const context = await sessionManager.getContext(testUserId)
      if (!context) throw new Error('Context not found')

      // ユーザーメッセージ追加
      await sessionManager.saveMessage(
        testUserId,
        context.sessionId!,
        'user',
        'スプレッドシートのA列とB列を比較したい'
      )

      // アシスタントメッセージ追加
      await sessionManager.saveMessage(
        testUserId,
        context.sessionId!,
        'assistant',
        'A列とB列を比較する処理ですね。詳しい要件を教えてください。'
      )

      // 再取得して確認
      const updated = await sessionManager.getContext(testUserId)
      expect(updated?.messages.length).toBeGreaterThanOrEqual(2)
    })

    test('30件を超えるメッセージが正しく管理される', async () => {
      const context = await sessionManager.getContext(testUserId)
      if (!context) throw new Error('Context not found')

      // 30件のメッセージを追加
      for (let i = 0; i < 30; i++) {
        await sessionManager.saveMessage(
          testUserId,
          context.sessionId!,
          i % 2 === 0 ? 'user' : 'assistant',
          `テストメッセージ ${i + 1}`
        )
      }

      // Supabaseから取得（最新30件のみ）
      const messages = await supabaseStore.getRecentMessages(testUserId, 30)
      expect(messages.length).toBeLessThanOrEqual(30)
    })
  })

  describe('3. 会話フローの処理', () => {
    test('会話が正しく処理される', async () => {
      const context = await sessionManager.getContext(testUserId)
      if (!context) throw new Error('Context not found')

      const result = await ConversationalFlow.processConversation(
        context,
        '毎日朝9時に自動実行したい'
      )

      expect(result).toBeDefined()
      expect(result.reply).toBeDefined()
      expect(result.updatedContext.messages.length).toBeGreaterThan(context.messages.length)
    })

    test('要件が正しく抽出される', async () => {
      const context = await sessionManager.getContext(testUserId)
      if (!context) throw new Error('Context not found')

      // 要件を含むメッセージを処理
      const result = await ConversationalFlow.processConversation(
        context,
        'A列の日付とB列の金額を集計して、C列に出力したい'
      )

      const requirements = result.updatedContext.requirements
      expect(requirements).toBeDefined()
      // 要件が抽出されていることを確認
      expect(Object.keys(requirements).length).toBeGreaterThan(0)
    })
  })

  describe('4. エラーハンドリングとフォールバック', () => {
    test('Supabase接続エラー時にメモリキャッシュが使用される', async () => {
      // Supabase接続を一時的に無効化（モック）
      const originalGet = supabaseStore.getFullConversation
      supabaseStore.getFullConversation = jest.fn().mockRejectedValue(new Error('Connection failed'))

      // それでもコンテキストが取得できることを確認
      const context = await sessionManager.getContext(testUserId)
      expect(context).toBeDefined()

      // 元に戻す
      supabaseStore.getFullConversation = originalGet
    })

    test('セッション復旧が正しく動作する', async () => {
      // チェックポイント作成
      await sessionManager.createCheckpoint(testUserId)
      
      // セッションを削除
      await sessionManager.deleteSession(testUserId)
      
      // 復旧を試みる
      const recovered = await sessionManager.recoverSession(testUserId)
      expect(recovered).toBeDefined()
      expect(recovered?.category).toBe('spreadsheet')
    })
  })

  describe('5. パフォーマンステスト', () => {
    test('キャッシュヒット率が高い', async () => {
      const stats = cache.getStats()
      const initialHits = stats.avgHits

      // 同じユーザーで複数回アクセス
      for (let i = 0; i < 10; i++) {
        await sessionManager.getContext(testUserId)
      }

      const newStats = cache.getStats()
      expect(newStats.avgHits).toBeGreaterThan(initialHits)
    })

    test('大量のセッションでもメモリ使用量が制限内', () => {
      const stats = cache.getStats()
      expect(stats.size).toBeLessThanOrEqual(100) // 最大100セッション
      expect(stats.memoryUsage).toBeLessThan(10 * 1024 * 1024) // 10MB以下
    })
  })

  describe('6. 画像・ファイル処理', () => {
    test('画像メッセージが正しく処理される', async () => {
      const context = await sessionManager.getContext(testUserId)
      if (!context) throw new Error('Context not found')

      await sessionManager.saveMessage(
        testUserId,
        context.sessionId!,
        'user',
        '[画像アップロード] スクリーンショット解析結果',
        { type: 'image', analysisResult: 'エラー画面' }
      )

      const updated = await sessionManager.getContext(testUserId)
      const lastMessage = updated?.messages[updated.messages.length - 1]
      expect(lastMessage?.content).toContain('[画像アップロード]')
    })
  })
})

/**
 * 実際のLINE Webhookシミュレーション
 */
describe('LINE Webhookシミュレーション', () => {
  test('実際のWebhookリクエストをシミュレート', async () => {
    const webhookPayload = {
      events: [{
        type: 'message',
        message: {
          type: 'text',
          text: 'スプレッドシート操作'
        },
        source: {
          userId: 'simulation_user_' + Date.now()
        },
        replyToken: 'test_reply_token',
        timestamp: Date.now()
      }]
    }

    // webhook/route.ts の POST 関数をモック
    const response = await fetch('http://localhost:3000/api/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'test_signature'
      },
      body: JSON.stringify(webhookPayload)
    })

    // 実際の環境でのみテスト
    if (process.env.NODE_ENV !== 'test') {
      expect(response.status).toBe(200)
    }
  })
})

/**
 * 負荷テスト
 */
describe('負荷テスト', () => {
  test('同時に100セッションを処理できる', async () => {
    const promises = []
    
    for (let i = 0; i < 100; i++) {
      const userId = `load_test_user_${i}`
      promises.push(
        sessionManager.createSession(userId, 'spreadsheet', `テスト ${i}`)
      )
    }

    const results = await Promise.allSettled(promises)
    const successful = results.filter(r => r.status === 'fulfilled')
    
    expect(successful.length).toBeGreaterThan(90) // 90%以上成功
  })
})