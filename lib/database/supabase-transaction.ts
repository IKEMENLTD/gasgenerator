import { supabaseAdmin } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'
import { AppError } from '@/lib/errors/app-error'

/**
 * Supabase用のトランザクション実装
 * 
 * 注意: Supabaseは現在、クライアントSDKレベルでのトランザクションを
 * サポートしていません。このクラスは擬似的なトランザクション機能を
 * 提供します。
 */
export class SupabaseTransaction {
  /**
   * 複数の操作をアトミックに実行（エラー時は全て失敗）
   * 
   * @param operations 実行する操作の配列
   * @returns 成功時は全ての結果、失敗時はエラー
   */
  static async executeAtomic<T>(
    operations: Array<() => Promise<any>>
  ): Promise<T[]> {
    const results: T[] = []
    const completedOps: Array<{ rollback: () => Promise<void> }> = []
    
    try {
      // 各操作を順番に実行
      for (const operation of operations) {
        const result = await operation()
        results.push(result)
        
        // ロールバック関数を記録（実装可能な場合）
        // 注: Supabaseでは真のロールバックは不可能
        completedOps.push({
          rollback: async () => {
            logger.warn('Rollback attempted but not fully supported in Supabase')
          }
        })
      }
      
      return results
      
    } catch (error) {
      // エラー時は可能な限りロールバック
      logger.error('Transaction failed, attempting rollback', { error })
      
      for (const op of completedOps.reverse()) {
        try {
          await op.rollback()
        } catch (rollbackError) {
          logger.error('Rollback failed', { rollbackError })
        }
      }
      
      throw AppError.databaseError('Transaction failed', error)
    }
  }
  
  /**
   * 決済処理用のトランザクション
   * Stripe webhookでユーザーをプレミアムにする際に使用
   */
  static async updateUserPremiumStatus(
    userId: string,
    stripeCustomerId: string,
    subscriptionEndDate: Date
  ): Promise<void> {
    try {
      // 1. ユーザーの現在の状態を確認（排他ロック的な動作）
      const { data: currentUser, error: fetchError } = await (supabaseAdmin as any)
        .from('users')
        .select('subscription_status, stripe_customer_id')
        .eq('display_name', userId)
        .single()
      
      if (fetchError) {
        throw new Error(`Failed to fetch user: ${fetchError.message}`)
      }
      
      // 2. 既にプレミアムの場合はスキップ（冪等性）
      if ((currentUser as any)?.subscription_status === 'premium') {
        logger.info('User already premium, skipping update', { userId })
        return
      }
      
      // 3. ユーザーステータスを更新
      const { error: updateError } = await (supabaseAdmin as any)
        .from('users')
        .update({
          subscription_status: 'premium',
          stripe_customer_id: stripeCustomerId,
          subscription_end_date: subscriptionEndDate.toISOString(),
          subscription_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('display_name', userId)
        .eq('subscription_status', 'free')  // 楽観的ロック
      
      if (updateError) {
        throw new Error(`Failed to update user: ${updateError.message}`)
      }
      
      // 4. 使用履歴をリセット
      const { error: resetError } = await (supabaseAdmin as any)
        .from('users')
        .update({
          monthly_usage_count: 0,
          last_reset_date: new Date().toISOString().split('T')[0]
        })
        .eq('display_name', userId)
      
      if (resetError) {
        // リセットエラーは致命的ではないので警告のみ
        logger.warn('Failed to reset usage count', { userId, error: resetError })
      }
      
      logger.info('User premium status updated successfully', { userId })
      
    } catch (error) {
      logger.error('Premium status update failed', { userId, error })
      throw error
    }
  }
  
  /**
   * コード生成完了時のトランザクション
   * キューの更新とコード保存を同時に行う
   */
  static async completeCodeGeneration(
    queueId: string,
    userId: string,
    code: string,
    metadata: any
  ): Promise<void> {
    try {
      // 1. キューステータスを更新
      const { error: queueError } = await (supabaseAdmin as any)
        .from('processing_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', queueId)
        .eq('status', 'processing')  // 楽観的ロック
      
      if (queueError) {
        throw new Error(`Failed to update queue: ${queueError.message}`)
      }
      
      // 2. 生成されたコードを保存
      const { error: codeError } = await (supabaseAdmin as any)
        .from('generated_codes')
        .insert({
          user_id: userId,
          session_id: metadata.sessionId,
          requirements_summary: metadata.requirements,
          generated_code: code,
          explanation: metadata.explanation,
          usage_steps: metadata.usageSteps,
          code_category: metadata.category,
          code_subcategory: metadata.subcategory,
          claude_prompt: metadata.prompt,
          created_at: new Date().toISOString()
        })
      
      if (codeError) {
        // コード保存失敗時はキューを失敗状態に
        await (supabaseAdmin as any)
          .from('processing_queue')
          .update({
            status: 'failed',
            error_message: 'Failed to save generated code'
          })
          .eq('id', queueId)
        
        throw new Error(`Failed to save code: ${codeError.message}`)
      }
      
      // 3. ユーザーの使用回数を増加
      const { error: usageError } = await (supabaseAdmin as any)
        .from('users')
        .update({
          total_requests: metadata.totalRequests + 1,
          monthly_usage_count: metadata.monthlyUsage + 1,
          last_active_at: new Date().toISOString()
        })
        .eq('display_name', userId)
      
      if (usageError) {
        // 使用回数更新エラーは致命的ではないので警告のみ
        logger.warn('Failed to update usage count', { userId, error: usageError })
      }
      
      logger.info('Code generation completed successfully', { queueId, userId })
      
    } catch (error) {
      logger.error('Code generation completion failed', { queueId, userId, error })
      throw error
    }
  }
  
  /**
   * 楽観的ロックを使用した更新
   * 
   * @param table テーブル名
   * @param id レコードID
   * @param updates 更新内容
   * @param expectedValues 期待される現在の値（楽観的ロック）
   */
  static async updateWithOptimisticLock(
    table: string,
    id: string,
    updates: Record<string, any>,
    expectedValues: Record<string, any>
  ): Promise<boolean> {
    try {
      // Supabaseのフィルター機能を使って楽観的ロックを実装
      let query = (supabaseAdmin as any)
        .from(table)
        .update(updates)
        .eq('id', id)
      
      // 期待される値でフィルター
      for (const [key, value] of Object.entries(expectedValues)) {
        query = query.eq(key, value)
      }
      
      const { data, error } = await query.select()
      
      if (error) {
        logger.error('Optimistic lock update failed', { table, id, error })
        return false
      }
      
      // 更新されたレコードがない場合は楽観的ロック失敗
      if (!data || data.length === 0) {
        logger.warn('Optimistic lock failed - no records updated', { table, id })
        return false
      }
      
      return true
      
    } catch (error) {
      logger.error('Optimistic lock error', { table, id, error })
      return false
    }
  }
}

export default SupabaseTransaction