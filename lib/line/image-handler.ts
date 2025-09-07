import { LineApiClient } from './client'
import { logger } from '../utils/logger'
import { visionRateLimiter } from '../vision/rate-limiter'
import { supabaseAdmin } from '../supabase/client'

export class LineImageHandler {
  private lineClient: LineApiClient
  
  constructor() {
    this.lineClient = new LineApiClient()
  }
  
  /**
   * LINEから画像を取得して処理
   */
  async handleImageMessage(
    messageId: string,
    replyToken: string,
    userId: string
  ): Promise<{ 
    success: boolean
    description?: string
    error?: string 
  }> {
    logger.info('=== IMAGE HANDLER START ===', {
      messageId,
      userId,
      hasReplyToken: !!replyToken,
      envCheck: {
        hasLineToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
        hasSupabaseUrl: !!process.env.SUPABASE_URL
      }
    })
    
    try {
      // 1. LINE APIから画像データを取得
      logger.info('Step 1: Downloading image from LINE')
      const { buffer, contentType } = await this.downloadImage(messageId)
      logger.info('Step 1 completed: Image downloaded', { 
        bufferSize: buffer.length,
        contentType 
      })
      
      // 2. 画像ハッシュを計算
      const imageHash = visionRateLimiter.calculateImageHash(buffer)
      
      // 3. ユーザーのプレミアムステータス確認
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('subscription_status, subscription_end_date')
        .eq('line_user_id', userId)
        .single()
      
      const isPremium = user?.subscription_status === 'premium' && 
                       user?.subscription_end_date && 
                       new Date(user.subscription_end_date) > new Date()
      
      // 4. レート制限チェック
      const rateCheck = await visionRateLimiter.canUseVision(userId, imageHash, isPremium)
      
      if (!rateCheck.allowed) {
        await this.lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: `⚠️ 画像解析制限\n\n${rateCheck.reason}\n\n💡 テキストで説明していただければ、コード生成は無制限でご利用いただけます。`
        }])
        
        return { 
          success: false, 
          error: rateCheck.reason 
        }
      }
      
      // 5. 使用前確認（無料ユーザーのみ）
      if (!isPremium && rateCheck.remainingToday !== undefined && rateCheck.remainingToday <= 1) {
        // 最後の1回は確認を取る
        await this.lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: `📸 画像解析の確認\n\n本日の残り回数: ${rateCheck.remainingToday}回\n今月の残り回数: ${rateCheck.remainingMonth}回\n\n画像を解析しますか？`,
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '✅ 解析する', text: '画像を解析' }},
              { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' }}
            ]
          }
        }])
        
        // セッションに画像を一時保存（確認後に解析）
        // TODO: セッションストアに画像を保存する機能を追加
        
        return { 
          success: false, 
          error: 'Confirmation required' 
        }
      }
      
      // 6. 画像をBase64エンコード
      const base64Image = buffer.toString('base64')
      
      // デバッグ: 画像データの詳細を記録
      logger.info('Image data prepared for Vision API', {
        userId,
        messageId,
        imageSize: buffer.length,
        contentType,
        base64Length: base64Image.length,
        bufferFirstBytes: buffer.slice(0, 20).toString('hex'), // 最初の20バイトを16進数で
        base64Preview: base64Image.substring(0, 100) // Base64の最初の100文字
      })
      
      // 7. Claude Visionで画像を解析
      const startTime = Date.now()
      const description = await this.analyzeWithClaude(base64Image, contentType)
      const processingTime = Date.now() - startTime
      
      // デバッグ: Claudeの応答を詳細に記録
      logger.info('Claude Vision API analysis completed', {
        userId,
        messageId,
        processingTime,
        responseLength: description.length,
        responsePreview: description.substring(0, 500) // 応答の最初の500文字
      })
      
      // 8. 使用履歴を記録
      await visionRateLimiter.recordUsage(
        userId, 
        imageHash, 
        description,
        {
          imageSize: buffer.length,
          processingTime
        }
      )
      
      // 9. 解析結果を返信（残り回数も表示）
      const statusText = rateCheck.remainingToday !== undefined 
        ? `\n\n📊 本日の残り: ${rateCheck.remainingToday - 1}回`
        : ''
      
      await this.lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: `📸 画像を確認しました！\n\n${description}${statusText}\n\nこの内容でコードを生成しますか？`,
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '✅ はい', text: 'はい、この内容で生成' }},
            { type: 'action', action: { type: 'message', label: '✏️ 追加説明', text: '追加で説明します' }},
            { type: 'action', action: { type: 'message', label: '🔄 やり直し', text: '最初から' }}
          ]
        }
      }])
      
      return { 
        success: true, 
        description 
      }
      
    } catch (error) {
      logger.error('=== IMAGE HANDLER ERROR ===', { 
        messageId,
        userId,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : String(error)
      })
      
      // エラーメッセージを送信（エラー詳細も含む）
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: `画像の処理に失敗しました。\n\nエラー: ${errorMessage}\n\nテキストで説明していただけますか？`
      }])
      
      return { 
        success: false, 
        error: errorMessage
      }
    }
  }
  
  /**
   * LINE APIから画像をダウンロード
   */
  private async downloadImage(messageId: string): Promise<{
    buffer: Buffer
    contentType: string
  }> {
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!accessToken) {
      logger.error('LINE_CHANNEL_ACCESS_TOKEN is missing')
      throw new Error('LINE API configuration error')
    }
    
    const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`
    
    logger.info('Downloading image from LINE', { messageId, url })
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`)
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // 画像サイズチェック (5MB制限)
    const MAX_SIZE = 5 * 1024 * 1024
    if (buffer.length > MAX_SIZE) {
      throw new Error(`Image too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB (max 5MB)`)
    }
    
    return { buffer, contentType }
  }
  
  /**
   * Claude Vision APIで画像を解析
   */
  private async analyzeWithClaude(base64Image: string, contentType: string): Promise<string> {
    // API キーチェック
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      logger.critical('ANTHROPIC_API_KEY is missing - Vision API cannot function')
      throw new Error('Vision API is not configured')
    }
    
    try {
      // contentTypeからmedia_typeを決定（Claude Vision対応形式）
      let mediaType = 'image/jpeg'
      
      // Claude Vision APIがサポートする形式
      const supportedTypes: Record<string, string> = {
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'jpeg': 'image/jpeg',
        'jpg': 'image/jpeg',
        'bmp': 'image/jpeg', // BMPはJPEGとして送る
        'tiff': 'image/jpeg', // TIFFもJPEGとして送る
        'tif': 'image/jpeg',
        'heic': 'image/jpeg', // HEICもJPEGとして送る（要変換）
        'heif': 'image/jpeg'
      }
      
      // contentTypeから拡張子を抽出
      for (const [ext, mimeType] of Object.entries(supportedTypes)) {
        if (contentType.toLowerCase().includes(ext)) {
          mediaType = mimeType
          break
        }
      }
      
      // サポート外形式の警告
      if (!Object.keys(supportedTypes).some(ext => contentType.toLowerCase().includes(ext))) {
        logger.warn('Unsupported image format, using JPEG as fallback', { contentType })
      }
      
      // APIリクエストのペイロード作成
      const requestPayload = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `この画像を分析して、含まれている内容を日本語で詳しく説明してください。
                  
もしスプレッドシートやデータの画像の場合は：
- 列の構成（列名やデータの種類）
- 行数の概算
- データの形式や特徴
- 処理に必要そうな情報

もしコードやエラー画面の場合は：
- 表示されているコードやエラーメッセージ
- プログラミング言語
- 問題の詳細

その他の画像の場合は、見えるものを具体的に説明してください。`
                },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64Image
                  }
                }
              ]
            }
          ]
      }
      
      // デバッグ: APIリクエストの詳細を記録
      logger.info('Sending request to Claude Vision API', {
        model: requestPayload.model,
        mediaType,
        base64DataLength: base64Image.length,
        base64DataSample: base64Image.substring(0, 50) + '...' + base64Image.substring(base64Image.length - 50)
      })
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestPayload)
      })
      
      if (!response.ok) {
        const errorData = await response.text()
        logger.error('Claude Vision API error', { 
          status: response.status, 
          error: errorData 
        })
        throw new Error(`Claude Vision API failed: ${response.status}`)
      }
      
      const data = await response.json()
      
      // デバッグ: APIレスポンスの詳細を記録
      logger.info('Claude Vision API response received', {
        hasContent: !!data.content,
        contentLength: data.content?.[0]?.text?.length || 0,
        responseStructure: Object.keys(data),
        fullResponse: JSON.stringify(data).substring(0, 1000) // 最初の1000文字
      })
      
      if (!data.content || !data.content[0]?.text) {
        logger.error('Invalid Claude Vision API response structure', { data })
        throw new Error('Invalid response from Claude Vision API')
      }
      
      return data.content[0].text
      
    } catch (error) {
      logger.error('Failed to analyze image with Claude', { error })
      
      // フォールバック応答
      return `画像の分析中にエラーが発生しました。
      
お手数ですが、以下の情報をテキストで教えてください：
- どのようなデータまたは画面の画像か
- 処理したい内容の詳細`
    }
  }
  
  /**
   * ファイルメッセージの処理
   */
  async handleFileMessage(
    messageId: string,
    fileName: string,
    replyToken: string,
    userId: string
  ): Promise<void> {
    try {
      const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
      
      // 画像ファイルの場合
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.heic', '.heif']
      if (imageExtensions.includes(extension)) {
        // 画像として処理
        logger.info('Processing image file', { fileName, extension })
        await this.handleImageMessage(messageId, replyToken, userId)
        return
      }
      
      // データファイルの場合（現在は画像変換を推奨）
      const dataFormats = ['.csv', '.xlsx', '.xls', '.pdf', '.svg', '.json', '.txt']
      if (dataFormats.includes(extension)) {
        await this.lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: `📎 ${fileName}を受信しました。\n\n現在、画像ファイルの解析に特化しています。\n\n📸 推奨方法：\n1. ファイルを開く\n2. スクリーンショットを撮る\n3. 画像として送信\n\nこの方法で、Excel・PDF・CSVなどのデータも解析可能です！`,
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '📸 使い方', text: '画像解析の使い方' }},
              { type: 'action', action: { type: 'message', label: '💎 プレミアム', text: 'プレミアムプラン' }}
            ]
          }
        }])
        return
      }
      
      // サポート外形式
      await this.lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: `⚠️ ${extension}ファイルは対応していません。\n\n📸 対応画像形式:\nJPG, PNG, GIF, WebP, BMP, TIFF, HEIC\n\n📊 今後対応予定:\nExcel, CSV, PDF\n\n画像として送信いただければ解析可能です。`
      }])
      
    } catch (error) {
      logger.error('File handling failed', { fileName, error })
      await this.lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: 'ファイルの処理に失敗しました。\n画像として再送信してください。'
      }])
    }
  }
}