import { logger } from '@/lib/utils/logger'
import { EventEmitter } from 'events'

interface WebSocketMessage {
  id: string
  type: 'ping' | 'pong' | 'message' | 'notification' | 'update' | 'error'
  channel?: string
  data?: any
  timestamp: number
}

interface SubscriptionHandler {
  channel: string
  handler: (data: any) => void
  filter?: (data: any) => boolean
}

export class WebSocketManager extends EventEmitter {
  private static instance: WebSocketManager | null = null
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private heartbeatInterval?: NodeJS.Timeout
  private subscriptions: Map<string, Set<SubscriptionHandler>> = new Map()
  private messageQueue: WebSocketMessage[] = []
  private isConnected = false
  private sessionId?: string

  private constructor(url: string) {
    super()
    this.url = url
  }

  static getInstance(url?: string): WebSocketManager {
    if (!this.instance) {
      if (!url) throw new Error('WebSocket URL is required')
      this.instance = new WebSocketManager(url)
    }
    return this.instance
  }

  /**
   * WebSocket接続の確立
   */
  async connect(sessionId?: string): Promise<void> {
    if (this.isConnected) {
      logger.debug('WebSocket already connected')
      return
    }

    this.sessionId = sessionId

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          logger.info('WebSocket connected', { url: this.url })
          this.isConnected = true
          this.reconnectAttempts = 0
          
          // ハートビート開始
          this.startHeartbeat()
          
          // キューに溜まったメッセージを送信
          this.flushMessageQueue()
          
          // 認証
          if (this.sessionId) {
            this.authenticate(this.sessionId)
          }
          
          this.emit('connected')
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onerror = (error) => {
          logger.error('WebSocket error', { error })
          this.emit('error', error)
        }

        this.ws.onclose = (event) => {
          logger.info('WebSocket disconnected', { 
            code: event.code, 
            reason: event.reason 
          })
          
          this.isConnected = false
          this.stopHeartbeat()
          
          this.emit('disconnected', event)
          
          // 自動再接続
          if (event.code !== 1000) { // 正常終了以外
            this.reconnect()
          }
        }

      } catch (error) {
        logger.error('Failed to create WebSocket', { error })
        reject(error)
      }
    })
  }

  /**
   * 認証処理
   */
  private authenticate(sessionId: string): void {
    this.send({
      type: 'auth',
      data: { sessionId }
    })
  }

  /**
   * メッセージ送信
   */
  send(message: Partial<WebSocketMessage>): void {
    const fullMessage: WebSocketMessage = {
      id: this.generateMessageId(),
      timestamp: Date.now(),
      type: 'message',
      ...message
    }

    if (!this.isConnected || !this.ws) {
      // 接続されていない場合はキューに追加
      this.messageQueue.push(fullMessage)
      logger.debug('Message queued', { messageId: fullMessage.id })
      return
    }

    try {
      this.ws.send(JSON.stringify(fullMessage))
      logger.debug('Message sent', { 
        messageId: fullMessage.id,
        type: fullMessage.type 
      })
    } catch (error) {
      logger.error('Failed to send message', { error })
      this.messageQueue.push(fullMessage)
    }
  }

  /**
   * チャンネルへの送信
   */
  publish(channel: string, data: any): void {
    this.send({
      type: 'message',
      channel,
      data
    })
  }

  /**
   * チャンネルの購読
   */
  subscribe(
    channel: string,
    handler: (data: any) => void,
    filter?: (data: any) => boolean
  ): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set())
      
      // サーバーに購読を通知
      this.send({
        type: 'subscribe',
        channel
      })
    }

    const subscription: SubscriptionHandler = {
      channel,
      handler,
      filter
    }

    this.subscriptions.get(channel)!.add(subscription)

    logger.debug('Subscribed to channel', { channel })

    // アンサブスクライブ関数を返す
    return () => {
      this.unsubscribe(channel, subscription)
    }
  }

  /**
   * チャンネルの購読解除
   */
  private unsubscribe(channel: string, subscription: SubscriptionHandler): void {
    const subs = this.subscriptions.get(channel)
    if (!subs) return

    subs.delete(subscription)

    if (subs.size === 0) {
      this.subscriptions.delete(channel)
      
      // サーバーに購読解除を通知
      this.send({
        type: 'unsubscribe',
        channel
      })
    }

    logger.debug('Unsubscribed from channel', { channel })
  }

  /**
   * メッセージ処理
   */
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data)
      
      logger.debug('Message received', {
        messageId: message.id,
        type: message.type,
        channel: message.channel
      })

      // メッセージタイプ別処理
      switch (message.type) {
        case 'pong':
          // ハートビート応答
          break
          
        case 'error':
          this.emit('error', message.data)
          break
          
        case 'notification':
          this.emit('notification', message.data)
          break
          
        case 'update':
          this.emit('update', message.data)
          break
          
        case 'message':
          if (message.channel) {
            this.handleChannelMessage(message.channel, message.data)
          } else {
            this.emit('message', message.data)
          }
          break
      }

    } catch (error) {
      logger.error('Failed to parse message', { data, error })
    }
  }

  /**
   * チャンネルメッセージの処理
   */
  private handleChannelMessage(channel: string, data: any): void {
    const subscriptions = this.subscriptions.get(channel)
    if (!subscriptions) return

    for (const sub of subscriptions) {
      // フィルター適用
      if (sub.filter && !sub.filter(data)) {
        continue
      }

      try {
        sub.handler(data)
      } catch (error) {
        logger.error('Subscription handler error', {
          channel,
          error
        })
      }
    }
  }

  /**
   * ハートビート開始
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' })
      }
    }, 30000) // 30秒ごと
  }

  /**
   * ハートビート停止
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = undefined
    }
  }

  /**
   * 再接続処理
   */
  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached')
      this.emit('reconnect_failed')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    logger.info('Attempting to reconnect', {
      attempt: this.reconnectAttempts,
      delay
    })

    this.emit('reconnecting', this.reconnectAttempts)

    setTimeout(async () => {
      try {
        await this.connect(this.sessionId)
        
        // 購読の再登録
        for (const channel of this.subscriptions.keys()) {
          this.send({
            type: 'subscribe',
            channel
          })
        }
      } catch (error) {
        logger.error('Reconnection failed', { error })
        this.reconnect()
      }
    }, delay)
  }

  /**
   * メッセージキューの送信
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (message) {
        this.ws?.send(JSON.stringify(message))
      }
    }
  }

  /**
   * メッセージIDの生成
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 接続の切断
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting')
      this.ws = null
    }
    
    this.isConnected = false
    this.stopHeartbeat()
    this.subscriptions.clear()
    this.messageQueue = []
  }

  /**
   * 接続状態の取得
   */
  getConnectionState(): {
    isConnected: boolean
    reconnectAttempts: number
    queuedMessages: number
    subscriptions: number
  } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      subscriptions: this.subscriptions.size
    }
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    this.disconnect()
    this.removeAllListeners()
    WebSocketManager.instance = null
  }
}

// Supabase Realtime用のラッパー
export class SupabaseRealtimeManager {
  private channels: Map<string, any> = new Map()

  /**
   * テーブルの変更を監視
   */
  subscribeToTable(
    table: string,
    callback: (payload: any) => void,
    filter?: Record<string, any>
  ): () => void {
    const channelName = `table:${table}`
    
    // Supabaseのリアルタイムチャンネル作成
    // 注: 実際のSupabase実装に応じて調整が必要
    const channel = this.createChannel(channelName, {
      event: '*',
      schema: 'public',
      table,
      filter
    }, callback)

    this.channels.set(channelName, channel)

    return () => {
      this.unsubscribeFromTable(table)
    }
  }

  /**
   * テーブル監視の解除
   */
  private unsubscribeFromTable(table: string): void {
    const channelName = `table:${table}`
    const channel = this.channels.get(channelName)
    
    if (channel) {
      channel.unsubscribe()
      this.channels.delete(channelName)
    }
  }

  /**
   * チャンネル作成（擬似実装）
   */
  private createChannel(
    name: string,
    config: any,
    callback: (payload: any) => void
  ): any {
    // Supabase Realtime実装
    logger.info('Creating realtime channel', { name, config })
    return {
      unsubscribe: () => {
        logger.info('Unsubscribing from channel', { name })
      }
    }
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    for (const channel of this.channels.values()) {
      channel.unsubscribe()
    }
    this.channels.clear()
  }
}