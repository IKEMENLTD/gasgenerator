import type { FlexMessage, TextMessage, Message } from '@line/bot-sdk'

// プロンプトメッセージ定数
const PROMPT_MESSAGES = {
  WELCOME: '👋 こんにちは！GASコードを自動生成します。\n\n作りたいコードのカテゴリを選んでください：',
  SUBCATEGORY_SELECT: (category: string) => `「${category}」を選択しました。\n具体的な内容を選んでください：`,
  DETAIL_INPUT: '詳しい要件を教えてください。\n\n例: 「売上データを月別に集計して、グラフを作成したい」',
  PROCESSING: '🔄 コードを生成中です...\nしばらくお待ちください（1-2分）',
  GENERATION_ERROR: '⚠️ 申し訳ございません。コード生成中にエラーが発生しました。\nもう一度お試しください。',
  SYSTEM_ERROR: '⚠️ システムエラーが発生しました。\n時間をおいて再度お試しください。',
}

export class MessageTemplates {
  static createRateLimitMessage(retryAfter: number): TextMessage {
    const minutes = Math.ceil(retryAfter / 60000)
    return {
      type: 'text',
      text: `⏱️ 利用制限に達しました。\n${minutes}分後に再度お試しください。`
    }
  }

  static createDetailInputPrompt(category?: string, subcategory?: string): TextMessage {
    let text = '詳しい要件を教えてください。\n\n'
    if (category) text += `カテゴリ: ${category}\n`
    if (subcategory) text += `種類: ${subcategory}\n\n`
    text += '例: 「売上データを月別に集計して、グラフを作成したい」'
    return {
      type: 'text',
      text
    }
  }
  static createWelcomeMessage(): Message[] {
    return [
      {
        type: 'text',
        text: '🎉 GAS Generator へようこそ！\n\nGoogle Apps Scriptのコードを自動生成するLINE Botです。\n\n✨ まずは無料トライアルでお試しください！'
      },
      {
        type: 'template',
        altText: '決済リンク',
        template: {
          type: 'buttons',
          title: '🚀 有料プランのご案内',
          text: '無制限でコード生成が可能に！',
          actions: [
            {
              type: 'uri',
              label: '💳 今すぐ購入（¥980/月）',
              uri: 'https://buy.stripe.com/7sY3cv2So0v78ICbSz6oo09'
            },
            {
              type: 'message',
              label: '🆓 無料で試す',
              text: 'コード生成を開始'
            }
          ]
        }
      } as any,
      {
        type: 'text',
        text: '作りたいコードのカテゴリを選んでください：',
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'message',
                label: '📊 スプレッドシート',
                text: 'スプレッドシート操作'
              }
            },
            {
              type: 'action',
              action: {
                type: 'message',
                label: '📧 Gmail',
                text: 'Gmail自動化'
              }
            },
            {
              type: 'action',
              action: {
                type: 'message',
                label: '📅 カレンダー',
                text: 'カレンダー連携'
              }
            },
            {
              type: 'action',
              action: {
                type: 'message',
                label: '🔗 API',
                text: 'API連携'
              }
            },
            {
              type: 'action',
              action: {
                type: 'message',
                label: '✨ その他',
                text: 'その他'
              }
            }
          ]
        }
      } as TextMessage
    ]
  }

  static createCategorySelection(): TextMessage {
    return {
      type: 'text',
      text: '「カレンダー連携」を選択しました。\n具体的な内容を選んでください：',
      quickReply: {
        items: [
          {
            type: 'action',
            action: {
              type: 'message',
              label: '📊 スプレッドシート',
              text: 'スプレッドシート操作'
            }
          },
          {
            type: 'action',
            action: {
              type: 'message',
              label: '📧 Gmail',
              text: 'Gmail自動化'
            }
          },
          {
            type: 'action',
            action: {
              type: 'message',
              label: '📅 カレンダー',
              text: 'カレンダー連携'
            }
          },
          {
            type: 'action',
            action: {
              type: 'message',
              label: '🔗 API',
              text: 'API連携'
            }
          },
          {
            type: 'action',
            action: {
              type: 'message',
              label: '✨ その他',
              text: 'その他'
            }
          }
        ]
      }
    }
  }

  static createSubcategorySelection(categoryId: string): Message {
    const categories = {
      spreadsheet: {
        name: 'スプレッドシート操作',
        subcategories: [
          { id: 'data-aggregation', name: 'データ集計', icon: '📊' },
          { id: 'data-transfer', name: 'データ転記', icon: '📝' },
          { id: 'data-extraction', name: 'データ抽出', icon: '🔍' },
          { id: 'formatting', name: '書式設定', icon: '🎨' },
          { id: 'chart-creation', name: 'グラフ作成', icon: '📈' }
        ]
      },
      gmail: {
        name: 'Gmail自動化',
        subcategories: [
          { id: 'auto-send', name: '自動送信', icon: '📤' },
          { id: 'auto-reply', name: '自動返信', icon: '↩️' },
          { id: 'email-extraction', name: 'メール抽出', icon: '📥' },
          { id: 'attachment-processing', name: '添付ファイル処理', icon: '📎' },
          { id: 'label-management', name: 'ラベル管理', icon: '🏷️' }
        ]
      },
      calendar: {
        name: 'カレンダー連携',
        subcategories: [
          { id: 'event-creation', name: 'イベント作成', icon: '📅' },
          { id: 'event-update', name: 'イベント更新', icon: '✏️' },
          { id: 'event-extraction', name: 'イベント取得', icon: '📋' },
          { id: 'reminder-setting', name: 'リマインダー設定', icon: '⏰' },
          { id: 'recurring-event', name: '定期イベント', icon: '🔄' }
        ]
      },
      api: {
        name: 'API連携',
        subcategories: [
          { id: 'data-fetch', name: 'データ取得', icon: '⬇️' },
          { id: 'data-post', name: 'データ送信', icon: '⬆️' },
          { id: 'webhook', name: 'Webhook処理', icon: '🪝' },
          { id: 'oauth', name: 'OAuth認証', icon: '🔐' },
          { id: 'batch-processing', name: 'バッチ処理', icon: '⚙️' }
        ]
      }
    }

    const category = categories[categoryId as keyof typeof categories]
    
    if (!category) {
      return {
        type: 'text',
        text: '詳しい要件を教えてください。'
      }
    }

    return {
      type: 'text',
      text: PROMPT_MESSAGES.SUBCATEGORY_SELECT(category.name),
      quickReply: {
        items: category.subcategories.map(sub => ({
          type: 'action',
          action: {
            type: 'message',
            label: `${sub.icon} ${sub.name}`,
            text: sub.name
          }
        }))
      }
    } as TextMessage
  }

  static createDetailInputPrompt(): TextMessage {
    return {
      type: 'text',
      text: PROMPT_MESSAGES.DETAIL_INPUT
    }
  }

  static createProcessingMessage(): TextMessage {
    return {
      type: 'text',
      text: PROMPT_MESSAGES.PROCESSING
    }
  }

  static createCodeResult(summary: string, explanation: string, code: string): Message[] {
    const messages: Message[] = [
      {
        type: 'text',
        text: `✅ ${summary}`
      },
      {
        type: 'text',
        text: explanation
      }
    ]

    if (code.length <= 1000) {
      messages.push({
        type: 'text',
        text: `\`\`\`javascript\n${code}\n\`\`\``
      })
    } else {
      messages.push({
        type: 'text',
        text: `📝 コードが長いため、分割して送信します：`
      })
      
      const chunks = this.splitCode(code, 1000)
      chunks.forEach((chunk, index) => {
        messages.push({
          type: 'text',
          text: `[Part ${index + 1}/${chunks.length}]\n\`\`\`javascript\n${chunk}\n\`\`\``
        })
      })
    }

    return messages
  }

  static createErrorMessage(errorType: 'generation' | 'system' = 'system'): TextMessage {
    return {
      type: 'text',
      text: errorType === 'generation' ? PROMPT_MESSAGES.GENERATION_ERROR : PROMPT_MESSAGES.SYSTEM_ERROR
    }
  }

  static createUsageGuide(): Message[] {
    return [
      {
        type: 'text',
        text: '📘 使い方ガイド\n\n1. カテゴリを選択\n2. サブカテゴリを選択\n3. 詳細な要件を入力\n\n数分でコードが生成されます！'
      }
    ]
  }

  private static splitCode(code: string, maxLength: number): string[] {
    const lines = code.split('\n')
    const chunks: string[] = []
    let currentChunk = ''

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        chunks.push(currentChunk)
        currentChunk = line
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk)
    }

    return chunks
  }
}

export const EXAMPLE_PROMPTS = {
  spreadsheet: [
    'Aシートの売上データを月別に集計したい',
    '複数シートのデータをまとめて1つのシートに転記したい',
    '条件に合うデータだけを別シートに抽出したい'
  ] as string[],
  gmail: [
    'スプレッドシートのデータを使って請求書メールを自動送信したい',
    '毎週金曜日に週報を自動送信したい',
    '特定の件名のメールを受信したらスプレッドシートに記録したい'
  ] as string[],
  calendar: [
    'スプレッドシートの予定表からカレンダーに一括登録したい',
    '毎月の定期ミーティングを自動で設定したい',
    '来週の予定をスプレッドシートに出力したい'
  ] as string[],
  api: [
    '外部のWeb APIからデータを取得してスプレッドシートに保存したい',
    'スプレッドシートのデータを外部システムに自動送信したい',
    '定期的にAPIを呼び出してデータを更新したい'
  ] as string[]
}

export function getExamplePrompts(category: string): string[] {
  return EXAMPLE_PROMPTS[category as keyof typeof EXAMPLE_PROMPTS] || []
}

// 別名メソッド（互換性のため）
export const createDetailPrompt = MessageTemplates.createDetailInputPrompt
export const createSubCategorySelection = MessageTemplates.createSubcategorySelection
