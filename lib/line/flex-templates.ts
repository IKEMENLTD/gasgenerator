// Flex message types
type FlexMessage = {
  type: 'flex'
  altText: string
  contents: any
}

export class FlexTemplates {
  /**
   * ウェルカムメッセージ（Flexメッセージ版）
   */
  static createWelcomeFlexMessage(): FlexMessage {
    return {
      type: 'flex',
      altText: 'GAS Generatorへようこそ！月額¥10,000で無制限利用可能',
      contents: {
        type: 'bubble',
        hero: {
          type: 'image',
          url: 'https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_1_cafe.png',
          size: 'full',
          aspectRatio: '20:13',
          aspectMode: 'cover'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'text',
              text: 'GAS Generator',
              size: 'xl',
              weight: 'bold',
              color: '#4F46E5'
            },
            {
              type: 'text',
              text: 'Google Apps Scriptのコードを自動生成',
              size: 'sm',
              color: '#666666',
              wrap: true
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              margin: 'md',
              contents: [
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: '無料プラン',
                      size: 'sm',
                      weight: 'bold',
                      flex: 3
                    },
                    {
                      type: 'text',
                      text: '月10回まで',
                      size: 'sm',
                      color: '#666666',
                      flex: 5
                    }
                  ]
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: '有料プラン',
                      size: 'sm',
                      weight: 'bold',
                      color: '#4F46E5',
                      flex: 3
                    },
                    {
                      type: 'text',
                      text: '¥10,000/月で無制限',
                      size: 'sm',
                      color: '#4F46E5',
                      flex: 5
                    }
                  ]
                }
              ]
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              action: {
                type: 'uri',
                label: '🎯 今すぐ購入（¥10,000/月）',
                uri: process.env.STRIPE_PAYMENT_LINK || 'https://example.com/upgrade'
              },
              style: 'primary',
              color: '#4F46E5',
              height: 'sm'
            },
            {
              type: 'button',
              action: {
                type: 'message',
                label: '無料で始める',
                text: 'コード生成を開始'
              },
              style: 'secondary',
              height: 'sm'
            }
          ]
        }
      }
    }
  }

  /**
   * 利用制限メッセージ（Flexメッセージ版）
   */
  static createLimitReachedFlexMessage(lineUserId: string): FlexMessage {
    const encoded = Buffer.from(lineUserId).toString('base64')
    const paymentUrl = `${process.env.STRIPE_PAYMENT_LINK || 'https://example.com/upgrade'}?client_reference_id=${encoded}`
    
    return {
      type: 'flex',
      altText: '無料プランの利用制限に達しました',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '⚠️',
                  size: 'xxl',
                  flex: 1
                },
                {
                  type: 'text',
                  text: '利用制限に達しました',
                  size: 'lg',
                  weight: 'bold',
                  color: '#FF6B6B',
                  flex: 5,
                  gravity: 'center'
                }
              ]
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'text',
              text: '無料プランの月間利用回数（10回）に達しました。',
              size: 'sm',
              color: '#666666',
              wrap: true,
              margin: 'md'
            },
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'xs',
              margin: 'lg',
              backgroundColor: '#F3F4F6',
              cornerRadius: 'md',
              paddingAll: 'md',
              contents: [
                {
                  type: 'text',
                  text: '🚀 プレミアムプランの特典',
                  size: 'sm',
                  weight: 'bold',
                  color: '#4F46E5'
                },
                {
                  type: 'text',
                  text: '✓ 無制限のコード生成',
                  size: 'xs',
                  color: '#666666',
                  margin: 'sm'
                },
                {
                  type: 'text',
                  text: '✓ 優先サポート',
                  size: 'xs',
                  color: '#666666'
                },
                {
                  type: 'text',
                  text: '✓ 高度なカスタマイズ',
                  size: 'xs',
                  color: '#666666'
                }
              ]
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              action: {
                type: 'uri',
                label: 'アップグレード（¥10,000/月）',
                uri: paymentUrl
              },
              style: 'primary',
              color: '#4F46E5',
              height: 'sm'
            },
            {
              type: 'button',
              action: {
                type: 'message',
                label: '来月まで待つ',
                text: '来月まで待つ'
              },
              style: 'secondary',
              height: 'sm'
            }
          ]
        }
      }
    }
  }

  /**
   * カテゴリ選択カルーセル
   */
  static createCategoryCarousel(): FlexMessage {
    return {
      type: 'flex',
      altText: 'カテゴリを選択してください',
      contents: {
        type: 'carousel',
        contents: [
          {
            type: 'bubble',
            size: 'micro',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#E0E7FF',
              paddingAll: 'md',
              contents: [
                {
                  type: 'text',
                  text: '📊',
                  size: 'xl',
                  align: 'center'
                }
              ]
            },
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'xs',
              paddingAll: 'md',
              contents: [
                {
                  type: 'text',
                  text: 'スプレッドシート',
                  size: 'sm',
                  weight: 'bold',
                  align: 'center'
                },
                {
                  type: 'text',
                  text: 'データ処理・集計',
                  size: 'xxs',
                  color: '#666666',
                  align: 'center',
                  wrap: true
                }
              ]
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'button',
                  action: {
                    type: 'message',
                    label: '選択',
                    text: 'スプレッドシート操作'
                  },
                  style: 'primary',
                  height: 'sm',
                  color: '#4F46E5'
                }
              ]
            }
          },
          {
            type: 'bubble',
            size: 'micro',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#FEE2E2',
              paddingAll: 'md',
              contents: [
                {
                  type: 'text',
                  text: '📧',
                  size: 'xl',
                  align: 'center'
                }
              ]
            },
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'xs',
              paddingAll: 'md',
              contents: [
                {
                  type: 'text',
                  text: 'Gmail',
                  size: 'sm',
                  weight: 'bold',
                  align: 'center'
                },
                {
                  type: 'text',
                  text: '自動送信・返信',
                  size: 'xxs',
                  color: '#666666',
                  align: 'center',
                  wrap: true
                }
              ]
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'button',
                  action: {
                    type: 'message',
                    label: '選択',
                    text: 'Gmail自動化'
                  },
                  style: 'primary',
                  height: 'sm',
                  color: '#EF4444'
                }
              ]
            }
          },
          {
            type: 'bubble',
            size: 'micro',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#DBEAFE',
              paddingAll: 'md',
              contents: [
                {
                  type: 'text',
                  text: '📅',
                  size: 'xl',
                  align: 'center'
                }
              ]
            },
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'xs',
              paddingAll: 'md',
              contents: [
                {
                  type: 'text',
                  text: 'カレンダー',
                  size: 'sm',
                  weight: 'bold',
                  align: 'center'
                },
                {
                  type: 'text',
                  text: 'イベント管理',
                  size: 'xxs',
                  color: '#666666',
                  align: 'center',
                  wrap: true
                }
              ]
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'button',
                  action: {
                    type: 'message',
                    label: '選択',
                    text: 'カレンダー連携'
                  },
                  style: 'primary',
                  height: 'sm',
                  color: '#3B82F6'
                }
              ]
            }
          },
          {
            type: 'bubble',
            size: 'micro',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#F3E8FF',
              paddingAll: 'md',
              contents: [
                {
                  type: 'text',
                  text: '🔗',
                  size: 'xl',
                  align: 'center'
                }
              ]
            },
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'xs',
              paddingAll: 'md',
              contents: [
                {
                  type: 'text',
                  text: 'API連携',
                  size: 'sm',
                  weight: 'bold',
                  align: 'center'
                },
                {
                  type: 'text',
                  text: '外部サービス連携',
                  size: 'xxs',
                  color: '#666666',
                  align: 'center',
                  wrap: true
                }
              ]
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'button',
                  action: {
                    type: 'message',
                    label: '選択',
                    text: 'API連携'
                  },
                  style: 'primary',
                  height: 'sm',
                  color: '#9333EA'
                }
              ]
            }
          }
        ]
      }
    }
  }
}