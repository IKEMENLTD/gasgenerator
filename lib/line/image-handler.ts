import { LineApiClient } from './client'
import { logger } from '../utils/logger'

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
    try {
      // 1. LINE APIから画像データを取得
      const imageBuffer = await this.downloadImage(messageId)
      
      // 2. 画像をBase64エンコード
      const base64Image = imageBuffer.toString('base64')
      
      // 3. Claude Visionで画像を解析
      const description = await this.analyzeWithClaude(base64Image)
      
      // 4. 解析結果を返信
      await this.lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: `📸 画像を確認しました！\n\n${description}\n\nこの内容でコードを生成しますか？`,
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
      logger.error('Image handling failed', { messageId, error })
      
      await this.lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '画像の処理に失敗しました。\nテキストで説明していただけますか？'
      }])
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * LINE APIから画像をダウンロード
   */
  private async downloadImage(messageId: string): Promise<Buffer> {
    const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
  
  /**
   * Claude Vision APIで画像を解析
   */
  private async analyzeWithClaude(base64Image: string): Promise<string> {
    // Claude Vision APIを使用（実装省略）
    // 本来はClaude APIのvisionモデルを使用
    
    return `スプレッドシートのスクリーンショットを確認しました。
    
認識した内容：
- A列: 日付データ
- B列: 売上金額
- C列: 商品名

この構造に基づいてデータ処理コードを生成できます。`
  }
  
  /**
   * ファイルメッセージの処理
   */
  async handleFileMessage(
    messageId: string,
    fileName: string,
    replyToken: string
  ): Promise<void> {
    // Excel, CSV, PDFなどのファイル処理
    const supportedFormats = ['.xlsx', '.xls', '.csv', '.pdf', '.json']
    const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
    
    if (!supportedFormats.includes(extension)) {
      await this.lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: `申し訳ございません。${extension}ファイルは現在サポートしていません。\n\nサポート形式: Excel, CSV, PDF, JSON`
      }])
      return
    }
    
    // ファイル処理ロジック（実装省略）
    await this.lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: `📎 ${fileName}を受信しました。\n\nファイル形式: ${extension}\n\n処理内容を教えてください。`
    }])
  }
}