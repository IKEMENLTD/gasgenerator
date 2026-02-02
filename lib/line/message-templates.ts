import { StructuredResponse } from '../utils/structured-response'

// LINE Message型定義（@line/bot-sdk依存を排除）
type TextMessage = {
  type: 'text'
  text: string
  quickReply?: any
}

type Message = TextMessage | any

// プロンプトメッセージ定数
const PROMPT_MESSAGES = {
  WELCOME: '👋 こんにちは！GASコードを自動生成します。\n\n作りたいコードのカテゴリを選んでください：',
  SUBCATEGORY_SELECT: (category: string) => `「${category}」を選択しました。\n具体的な内容を選んでください：`,
  DETAIL_INPUT: '具体的な要件を教えてください。\n\n例：\n・「A列のデータをB列にコピー」\n・「毎日9時にメール送信」\n・「カレンダーに予定を一括登録」',
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
    let text = '📝 具体的な要件を教えてください。\n\n'
    if (category) text += `📦 カテゴリ: ${category}\n`
    if (subcategory) text += `🎯 種類: ${subcategory}\n\n`
    
    // カテゴリに応じた例を表示
    if (category?.includes('スプレッドシート')) {
      text += '例：\n・「A列とB列を比較してC列に結果を出力」\n・「毎月の売上を集計してグラフ作成」'
    } else if (category?.includes('カレンダー')) {
      text += '例：\n・「スプレッドシートから予定を一括登録」\n・「毎週の定例会議を自動設定」'
    } else if (category?.includes('Gmail')) {
      text += '例：\n・「毎朝9時にレポートを自動送信」\n・「特定のメールを受信したら通知」'
    } else {
      text += '例：\n・「毎日のデータを自動バックアップ」\n・「APIからデータを取得して保存」'
    }
    
    return {
      type: 'text',
      text,
      quickReply: {
        items: [
          {
            type: 'action',
            action: {
              type: 'message',
              label: '👨‍💻 エンジニアに相談',
              text: 'エンジニアに相談する'
            }
          }
        ]
      }
    }
  }
  static createWelcomeMessage(): Message[] {
    return [
      {
        type: 'text',
        text: '🎉 Task mate へようこそ！\n\nGoogle Apps Scriptのコードを自動生成するLINE Botです。\n\n📢 2025年9月より本番運用を開始しました。\n現在も改善を重ねておりますが、一部エラーが発生する場合がございます。お手数ですが、不具合等お気づきの点がございましたらお知らせいただけますと幸いです。'
      },
      {
        type: 'template',
        altText: '有料プランのご案内\n\n月額¥10,000で無制限利用が可能です！',
        template: {
          type: 'buttons',
          text: '月額¥10,000で無制限コード生成！\n今なら初月割引あり',
          actions: [
            {
              type: 'uri',
              label: '購入する（¥10,000/月）',
              uri: process.env.STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/7sY3cv2So0v78ICbSz6oo09'
            },
            {
              type: 'message',
              label: '無料で試す',
              text: 'コード生成を開始'
            },
            {
              type: 'message',
              label: '👨‍💻 エンジニアに相談',
              text: 'エンジニアに相談する'
            }
          ]
        }
      },
      {
        type: 'text',
        text: '📦 まずはシステム一覧から、すぐ使えるシステムをチェック！\n\nまたは作りたいコードのカテゴリを選んでください：',
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'message',
                label: '📦 システム一覧',
                text: 'システム一覧'
              }
            },
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
                label: '👨‍💻 エンジニア相談',
                text: 'エンジニアに相談する'
              }
            },
            {
              type: 'action',
              action: {
                type: 'message',
                label: '📋 メニュー',
                text: 'メニュー'
              }
            }
          ]
        }
      }
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


  static createProcessingMessage(): TextMessage {
    return {
      type: 'text',
      text: PROMPT_MESSAGES.PROCESSING
    }
  }

  static createCodeResult(summary: string, explanation: string, code: string): Message[] {
    // 構造化レスポンスフォーマッターを使用
    const structuredResponse = new StructuredResponse()
    
    // レスポンステキストを構築
    const fullResponse = `${summary}\n\n${explanation}\n\nコード:\n\`\`\`javascript\n${code}\n\`\`\``
    
    // 構造化されたメッセージを返す
    return structuredResponse.formatResponse(fullResponse)
  }

  // 新しいメソッド: 構造化されたコード結果を作成
  static createStructuredCodeResult(responseText: string): Message[] {
    const structuredResponse = new StructuredResponse()
    return structuredResponse.formatResponse(responseText)
  }

  // クイックリプライアクションを作成
  static createQuickReplyActions(): any {
    return {
      items: [
        {
          type: 'action',
          action: {
            type: 'message',
            label: '🔄 修正したい',
            text: '修正したい'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '✨ 新しく作る',
            text: 'コード生成を開始'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '👨‍💻 エンジニア相談',
            text: 'エンジニアに相談する'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '📖 使い方',
            text: '使い方を教えて'
          }
        }
      ]
    }
  }

  static createErrorMessage(errorType: 'generation' | 'system' = 'system'): TextMessage {
    return {
      type: 'text',
      text: errorType === 'generation' ? PROMPT_MESSAGES.GENERATION_ERROR : PROMPT_MESSAGES.SYSTEM_ERROR,
      quickReply: MessageTemplates.createMainMenuQuickReply()
    }
  }

  static createUsageGuide(): Message[] {
    return [
      {
        type: 'text',
        text: '📘 使い方ガイド\n\n1. カテゴリを選択\n2. サブカテゴリを選択\n3. 詳細な要件を入力\n\n数分でコードが生成されます！',
        quickReply: MessageTemplates.createMainMenuQuickReply()
      }
    ]
  }

  /**
   * メインメニューquickReply（「最初から」と同じメニュー）
   */
  static createMainMenuQuickReply(): any {
    return {
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
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '👨‍💻 エンジニア相談',
            text: 'エンジニアに相談する'
          }
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: '📋 メニュー',
            text: 'メニュー'
          }
        }
      ]
    }
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

// コード共有URL付きメッセージを作成
export function createCodeShareMessage(shareUrl: string, title: string, expiresInDays: number = 7): Message[] {
  return [
    {
      type: 'text',
      text: `✅ コードが完成しました！\n\n📝 ${title}`
    },
    {
      type: 'template',
      altText: 'コードを確認する',
      template: {
        type: 'buttons',
        text: `コードの確認はこちら\n\n📎 ブラウザで開いてコピーできます\n⏰ 有効期限: ${expiresInDays}日間`,
        actions: [
          {
            type: 'uri',
            label: '📋 コードを見る',
            uri: shareUrl
          }
        ]
      }
    } as any
  ]
}

/**
 * コード生成待ち時間にブログ記事へ誘導するカルーセルメッセージ
 * 3つの異なる記事を紹介
 */
export function createWaitingTimeCarousel(): Message {
  return {
    type: 'template',
    altText: '【待ち時間に読む】プログラミング初心者向けの記事をご紹介',
    template: {
      type: 'carousel',
      columns: [
        {
          thumbnailImageUrl: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=1024&h=1024&fit=crop',
          imageBackgroundColor: '#FFFFFF',
          title: 'エラー10回は普通です',
          text: 'ベテランエンジニアも毎日エラーと戦っている。エラーは学習の道しるべ',
          actions: [
            {
              type: 'uri',
              label: '記事を読む',
              uri: 'https://blog.taskmateai.net/posts/beginner-error-ten-times-normal/'
            }
          ]
        },
        {
          thumbnailImageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1024&h=1024&fit=crop',
          imageBackgroundColor: '#FFFFFF',
          title: 'もうダメだと思ったあなたへ',
          text: 'エラーが怖い？大丈夫、誰もが通る道です。初心者が知るべき真実',
          actions: [
            {
              type: 'uri',
              label: '詳しく見る',
              uri: 'https://blog.taskmateai.net/posts/beginner-error-mindset-first-truth/'
            }
          ]
        },
        {
          thumbnailImageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1024&h=1024&fit=crop',
          imageBackgroundColor: '#FFFFFF',
          title: '完璧なコードは不要',
          text: '動けばOK！事務職が始める業務自動化の新常識',
          actions: [
            {
              type: 'uri',
              label: '使い方を見る',
              uri: 'https://blog.taskmateai.net/posts/beginner-perfect-code-myth/'
            }
          ]
        }
      ]
    }
  } as any
}

// 別名メソッド（互換性のため）
export const createDetailPrompt = MessageTemplates.createDetailInputPrompt
export const createSubCategorySelection = MessageTemplates.createSubcategorySelection
