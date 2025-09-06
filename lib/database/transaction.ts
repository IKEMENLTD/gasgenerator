import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'
import { AppError } from '@/lib/errors/app-error'

export interface TransactionOptions {
  isolationLevel?: 'read_committed' | 'repeatable_read' | 'serializable'
  maxRetries?: number
  retryDelay?: number
}

export class DatabaseTransaction {
  private static readonly DEFAULT_OPTIONS: TransactionOptions = {
    isolationLevel: 'read_committed',
    maxRetries: 3,
    retryDelay: 1000
  }

  /**
   * トランザクション内で処理を実行
   */
  static async executeInTransaction<T>(
    callback: (client: typeof supabase) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options }
    let attempt = 0
    
    while (attempt < opts.maxRetries!) {
      attempt++
      
      try {
        // Supabaseではトランザクションは自動的に処理される
        // エラー時は自動ロールバック
        const result = await callback(supabase)
        return result
      } catch (error) {
        const isRetryable = this.isRetryableError(error)
        
        logger.warn('Transaction failed', {
          attempt,
          maxRetries: opts.maxRetries,
          isRetryable,
          error: error instanceof Error ? error.message : String(error)
        })
        
        if (!isRetryable || attempt >= opts.maxRetries!) {
          throw AppError.databaseError('Transaction execution', error)
        }
        
        // リトライ前に待機
        await this.delay(opts.retryDelay! * attempt)
      }
    }
    
    throw AppError.databaseError('Transaction max retries exceeded', null)
  }

  /**
   * 複数の操作をバッチ実行
   */
  static async executeBatch<T>(
    operations: Array<() => Promise<any>>,
    options: TransactionOptions = {}
  ): Promise<T[]> {
    return this.executeInTransaction(async () => {
      const results: T[] = []
      
      for (const operation of operations) {
        try {
          const result = await operation()
          results.push(result)
        } catch (error) {
          logger.error('Batch operation failed', {
            operationIndex: results.length,
            totalOperations: operations.length,
            error
          })
          throw error // トランザクション全体をロールバック
        }
      }
      
      return results
    }, options)
  }

  /**
   * コード生成完了時の複合更新（トランザクション例）
   */
  static async completeCodeGeneration(
    queueId: string,
    userId: string,
    code: string,
    gasUrl: string
  ): Promise<void> {
    await this.executeInTransaction(async (client) => {
      // 1. キューのステータス更新
      const { error: queueError } = await client
        .from('generation_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          gas_url: gasUrl
        })
        .eq('id', queueId)
      
      if (queueError) throw queueError
      
      // 2. 生成済みコードの記録
      const { error: codeError } = await client
        .from('codes_generated')
        .insert({
          user_id: userId,
          queue_id: queueId,
          code,
          gas_url: gasUrl,
          created_at: new Date().toISOString()
        })
      
      if (codeError) throw codeError
      
      // 3. 使用状況の更新
      const { error: usageError } = await client
        .from('claude_usage')
        .insert({
          user_id: userId,
          prompt_tokens: 0, // 実際の値は呼び出し元から渡す
          completion_tokens: 0,
          total_tokens: 0,
          model: 'claude-3-sonnet-20240229',
          created_at: new Date().toISOString()
        })
      
      if (usageError) throw usageError
    })
  }

  /**
   * リトライ可能なエラーかチェック
   */
  private static isRetryableError(error: any): boolean {
    if (!error) return false
    
    const message = error.message?.toLowerCase() || ''
    const code = error.code?.toLowerCase() || ''
    
    // デッドロック、タイムアウト、一時的なエラー
    const retryablePatterns = [
      'deadlock',
      'timeout',
      'connection',
      'temporary',
      'conflict',
      '40001', // serialization failure
      '40P01', // deadlock detected
      '57014', // query canceled
      'ECONNRESET',
      'ETIMEDOUT'
    ]
    
    return retryablePatterns.some(pattern => 
      message.includes(pattern) || code.includes(pattern)
    )
  }

  /**
   * 遅延処理
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}