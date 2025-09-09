import { FlexMessage, FlexBubble } from '@line/bot-sdk'

export class FlexCodeTemplate {
  /**
   * 黒背景のコードブロックを含むFlex Messageを生成
   */
  static createCodeMessage(
    code: string,
    steps: string[],
    notes: string[],
    includeEngineerButton: boolean = true
  ): FlexMessage {
    return {
      type: 'flex',
      altText: 'GASコードを生成しました',
      contents: this.createCodeBubble(code, steps, notes, includeEngineerButton)
    }
  }

  private static createCodeBubble(
    code: string,
    steps: string[],
    notes: string[],
    includeEngineerButton: boolean
  ): FlexBubble {
    return {
      type: 'bubble',
      size: 'giga',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          // ヘッダー
          {
            type: 'text',
            text: '🎉 GAS コードを自動生成しました！',
            weight: 'bold',
            size: 'lg',
            color: '#1DB446',
            margin: 'md'
          },
          // コードブロック（黒背景）
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#1E1E1E',  // 黒背景
            cornerRadius: '8px',
            margin: 'lg',
            paddingAll: '12px',
            contents: [
              {
                type: 'text',
                text: 'javascript',
                color: '#569CD6',  // 青色（言語名）
                size: 'xs',
                margin: 'none'
              },
              {
                type: 'text',
                text: code,
                color: '#D4D4D4',  // 明るいグレー（コード本体）
                size: 'sm',
                wrap: true,
                margin: 'md'
              }
            ]
          },
          // 設定方法
          {
            type: 'text',
            text: '設定方法：',
            weight: 'bold',
            size: 'md',
            margin: 'xl'
          },
          ...this.createStepsList(steps),
          // 注意点
          {
            type: 'separator',
            margin: 'xl'
          },
          {
            type: 'text',
            text: '注意点：',
            weight: 'bold',
            size: 'md',
            margin: 'lg'
          },
          ...this.createNotesList(notes)
        ],
        paddingAll: '16px'
      },
      footer: this.createFooterButtons(includeEngineerButton)
    }
  }

  private static createStepsList(steps: string[]): any[] {
    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
    
    return steps.map((step, index) => ({
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      contents: [
        {
          type: 'text',
          text: numberEmojis[index] || `${index + 1}.`,
          flex: 0,
          size: 'md'
        },
        {
          type: 'text',
          text: step,
          flex: 1,
          size: 'sm',
          color: '#666666',
          wrap: true,
          margin: 'md'
        }
      ]
    }))
  }

  private static createNotesList(notes: string[]): any[] {
    return notes.map(note => ({
      type: 'box',
      layout: 'horizontal',
      margin: 'sm',
      contents: [
        {
          type: 'text',
          text: '•',
          flex: 0,
          size: 'sm',
          color: '#FF6B6B'
        },
        {
          type: 'text',
          text: note,
          flex: 1,
          size: 'xs',
          color: '#888888',
          wrap: true,
          margin: 'sm'
        }
      ]
    }))
  }

  private static createFooterButtons(includeEngineerButton: boolean): any {
    const buttons = [
      {
        type: 'button',
        action: {
          type: 'message',
          label: 'コードを修正',
          text: 'コードを修正したい'
        },
        style: 'secondary',
        height: 'sm'
      }
    ]

    if (includeEngineerButton) {
      buttons.push({
        type: 'button',
        action: {
          type: 'message',
          label: '👨‍💻 エンジニアに相談',
          text: 'エンジニアに相談する'
        },
        style: 'primary',
        height: 'sm',
        color: '#FF6B6B'
      })
    }

    buttons.push({
      type: 'button',
      action: {
        type: 'camera',
        label: '📸 エラー画面を送信'
      },
      style: 'secondary',
      height: 'sm'
    })

    return {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: buttons
    }
  }
}