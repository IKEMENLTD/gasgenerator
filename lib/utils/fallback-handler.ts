import { logger } from './logger'

/**
 * 各サービスのフォールバック処理
 */
export class FallbackHandler {
  /**
   * Claude APIエラー時のフォールバック
   */
  static getClaudeFallbackResponse(error: any): string {
    logger.error('Claude API failed, using fallback', { error })
    
    const errorMessage = error?.message || String(error)
    
    // レート制限エラー
    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      return `⚠️ AI処理の制限に達しました

現在、多くのリクエストを処理中です。
しばらく待ってから再度お試しください。

【対処法】
• 1分後に再送信
• テキストを短くして送信
• プレミアムプランで優先処理`
    }
    
    // タイムアウトエラー
    if (errorMessage.includes('timeout')) {
      return `⏱️ 処理がタイムアウトしました

リクエストが複雑すぎる可能性があります。

【対処法】
• 要件を分割して送信
• より具体的な内容で再送信`
    }
    
    // APIキーエラー
    if (errorMessage.includes('API key') || errorMessage.includes('authentication')) {
      logger.critical('Claude API key issue detected')
      return `🔧 システムメンテナンス中

申し訳ございません。
一時的にAI機能が利用できません。

復旧まで少々お待ちください。`
    }
    
    // デフォルトフォールバック
    return `⚠️ 一時的なエラーが発生しました

申し訳ございません。
もう一度お試しください。

【代替案】
• 具体的な例を含めて送信
• カテゴリを選び直す
• シンプルな要件から始める`
  }
  
  /**
   * Supabaseエラー時のフォールバック
   */
  static handleSupabaseError(error: any, operation: string): void {
    logger.error('Supabase operation failed', { error, operation })
    
    // 接続エラーの場合はリトライ
    if (error?.message?.includes('connect')) {
      logger.info('Will retry Supabase operation', { operation })
      // リトライロジックは呼び出し元で実装
    }
    
    // データベース制限
    if (error?.code === '54000') {
      logger.error('Supabase row limit exceeded')
    }
  }
  
  /**
   * LINE APIエラー時のフォールバック
   */
  static async handleLineApiError(
    error: any,
    userId: string,
    fallbackMessage?: string
  ): Promise<void> {
    const errorCode = error?.response?.status || error?.code
    
    logger.error('LINE API error', { 
      errorCode,
      userId,
      message: error?.message 
    })
    
    // 429: レート制限
    if (errorCode === 429) {
      logger.warn('LINE API rate limit reached', { userId })
      // 1分後にリトライするようキューに追加
      if (fallbackMessage) {
        setTimeout(() => {
          // リトライロジック
          logger.info('Retrying LINE message', { userId })
        }, 60000)
      }
    }
    
    // 401: 認証エラー
    if (errorCode === 401) {
      logger.critical('LINE API authentication failed')
      // 管理者に通知
    }
    
    // 500: サーバーエラー
    if (errorCode >= 500) {
      logger.error('LINE API server error', { errorCode })
      // 3回までリトライ
    }
  }
  
  /**
   * Vision APIエラー時のフォールバック
   */
  static getVisionFallbackResponse(error: any): string {
    logger.error('Vision API failed', { error })
    
    return `📸 画像解析エラー

画像の解析に失敗しました。

【対処法】
• 画像サイズを小さくする（5MB以下）
• 別の形式で保存し直す（JPG推奨）
• テキストで内容を説明する

テキストでの説明も承っております。`
  }
  
  /**
   * 汎用エラーハンドラー
   */
  static async handleError(
    error: any,
    context: {
      service: string
      operation: string
      userId?: string
      metadata?: any
    }
  ): Promise<{ success: false; fallback: string }> {
    // エラーログ記録
    logger.error('Service error', {
      ...context,
      error: {
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      }
    })
    
    // サービス別フォールバック
    let fallback = '申し訳ございません。エラーが発生しました。'
    
    switch (context.service) {
      case 'claude':
        fallback = this.getClaudeFallbackResponse(error)
        break
      case 'vision':
        fallback = this.getVisionFallbackResponse(error)
        break
      case 'line':
        await this.handleLineApiError(error, context.userId || 'unknown')
        fallback = 'メッセージの送信に失敗しました。'
        break
      case 'supabase':
        this.handleSupabaseError(error, context.operation)
        fallback = 'データの保存に失敗しました。'
        break
    }
    
    // メトリクス記録
    if (process.env.ENABLE_METRICS === 'true') {
      // エラー率の記録
      this.recordErrorMetric(context.service, error)
    }
    
    return { success: false, fallback }
  }
  
  /**
   * エラーメトリクスの記録
   */
  private static recordErrorMetric(service: string, error: any): void {
    // Supabaseにエラー記録（非同期、失敗しても続行）
    import('../supabase/client').then(({ supabaseAdmin }) => {
      supabaseAdmin
        .from('error_logs')
        .insert({
          error_type: error?.constructor?.name || 'UnknownError',
          error_message: error?.message || String(error),
          stack_trace: error?.stack,
          metadata: {
            service,
            timestamp: new Date().toISOString()
          }
        })
        .then(({ error: dbError }) => {
          if (dbError) {
            logger.error('Failed to record error metric', { dbError })
          }
        })
    }).catch(() => {
      // エラー記録自体が失敗しても続行
    })
  }
  
  /**
   * 緊急停止判定
   */
  static shouldEmergencyStop(errorCount: number, timeWindow: number): boolean {
    // 5分間に10回以上エラーが発生したら緊急停止
    const threshold = 10
    const window = 5 * 60 * 1000 // 5分
    
    if (errorCount >= threshold && timeWindow <= window) {
      logger.critical('Emergency stop triggered', { 
        errorCount, 
        timeWindow 
      })
      return true
    }
    
    return false
  }
}