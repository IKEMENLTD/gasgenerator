import { MessageStructureParser, ParsedResponse } from './response-parser'

type Message = {
  type: string
  text?: string
  altText?: string
  template?: any
}

export class StructuredResponse {
  private parser: MessageStructureParser

  constructor() {
    this.parser = new MessageStructureParser()
  }

  formatResponse(responseText: string): Message[] {
    try {
      const parsed = this.parser.parse(responseText)
      
      if (parsed.fallback) {
        return this.createFallbackMessages(parsed.fallback)
      }

      return this.createStructuredMessages(parsed)
    } catch (error) {
      console.error('Failed to format structured response:', error)
      // エラー時は単純なテキストメッセージとして返す
      return this.createFallbackMessages(responseText)
    }
  }

  private createStructuredMessages(parsed: ParsedResponse): Message[] {
    const messages: Message[] = []

    // イントロメッセージ
    if (parsed.intro) {
      messages.push({
        type: 'text',
        text: `✅ ${parsed.intro}`
      })
    }

    // コードセクション（メッセージ数を考慮）
    if (parsed.code?.hasCode && parsed.code.content) {
      const codeMessages = this.createCodeMessages(parsed.code)
      // LINEの5メッセージ制限を考慮
      if (messages.length + codeMessages.length <= 4) {
        messages.push(...codeMessages)
      } else if (messages.length < 4) {
        // 最低1つのコードメッセージは含める
        messages.push(codeMessages[0])
      }
    }

    // 設定手順セクション（残りメッセージ数を考慮）
    if (parsed.steps && parsed.steps.length > 0 && messages.length < 4) {
      messages.push(this.createStepsMessage(parsed.steps))
    }

    // 注意点セクション（残りメッセージ数を考慮）
    if (parsed.notes && parsed.notes.length > 0 && messages.length < 4) {
      messages.push(this.createNotesMessage(parsed.notes))
    }

    // 操作ボタン（必ず最後に追加）
    if (messages.length < 5) {
      messages.push(this.createActionButtons())
    }

    return messages
  }

  private createCodeMessages(code: { language: string; content: string }): Message[] {
    const messages: Message[] = []
    
    // コードヘッダー
    messages.push({
      type: 'text',
      text: `📝 コード (${this.getLanguageLabel(code.language)}):`
    })

    // コードが長い場合は分割
    if (code.content.length <= 2000) {
      messages.push({
        type: 'text',
        text: `\`\`\`${code.language}\n${code.content}\n\`\`\``
      })
    } else {
      const chunks = this.splitCode(code.content, 1800)
      chunks.forEach((chunk, index) => {
        messages.push({
          type: 'text',
          text: `[Part ${index + 1}/${chunks.length}]\n\`\`\`${code.language}\n${chunk}\n\`\`\``
        })
      })
    }

    return messages
  }

  private createStepsMessage(steps: string[]): Message {
    const stepsList = steps.map((step, index) => 
      `${index + 1}. ${step}`
    ).join('\n')

    return {
      type: 'text',
      text: `📋 設定方法:\n\n${stepsList}`
    }
  }

  private createNotesMessage(notes: string[]): Message {
    const notesList = notes.map(note => `• ${note}`).join('\n')

    return {
      type: 'text',
      text: `⚠️ 注意点:\n\n${notesList}`
    }
  }

  private createActionButtons(): Message {
    return {
      type: 'template',
      altText: 'コード生成完了',
      template: {
        type: 'buttons',
        text: 'コードの生成が完了しました\n\nエラーが出た場合は📷ボタンでスクリーンショットを送信してください',
        actions: [
          {
            type: 'message',
            label: '🔄 修正したい',
            text: '修正したい'
          },
          {
            type: 'message',
            label: '📷 エラースクショを送る',
            text: 'エラーのスクリーンショットを送る'
          },
          {
            type: 'message',
            label: '📖 使い方',
            text: '使い方を教えて'
          }
        ]
      }
    }
  }

  private createFallbackMessages(text: string): Message[] {
    // フォールバック: 従来の単純な分割
    if (text.length <= 2000) {
      return [
        {
          type: 'text',
          text
        },
        this.createActionButtons()
      ]
    }

    const messages: Message[] = []
    const chunks = this.splitText(text, 1800)
    
    chunks.forEach((chunk, index) => {
      messages.push({
        type: 'text',
        text: chunks.length > 1 ? `[${index + 1}/${chunks.length}]\n${chunk}` : chunk
      })
    })

    messages.push(this.createActionButtons())
    return messages
  }

  private splitCode(code: string, maxLength: number): string[] {
    const lines = code.split('\n')
    const chunks: string[] = []
    let currentChunk = ''

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk)
        }
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

  private splitText(text: string, maxLength: number): string[] {
    const chunks: string[] = []
    let currentIndex = 0

    while (currentIndex < text.length) {
      let endIndex = currentIndex + maxLength
      
      // 改行位置で区切る
      if (endIndex < text.length) {
        const lastNewline = text.lastIndexOf('\n', endIndex)
        if (lastNewline > currentIndex) {
          endIndex = lastNewline
        }
      }

      chunks.push(text.substring(currentIndex, endIndex).trim())
      currentIndex = endIndex
    }

    return chunks
  }

  private getLanguageLabel(lang: string): string {
    const labels: { [key: string]: string } = {
      'javascript': 'JavaScript / GAS',
      'js': 'JavaScript / GAS',
      'gas': 'Google Apps Script',
      'python': 'Python',
      'html': 'HTML',
      'css': 'CSS',
      'json': 'JSON'
    }
    return labels[lang.toLowerCase()] || 'Code'
  }
}

// 構造化レスポンスのサンプルテンプレート
export const STRUCTURED_TEMPLATES = {
  spreadsheet: {
    intro: 'スプレッドシートのA列とB列を比較してC列にチェックを入れるコードを生成しました。',
    steps: [
      'Google スプレッドシートを開く',
      'メニューから「拡張機能」→「Apps Script」を選択',
      '既存のコードを削除して、上記のコードを貼り付け',
      'プロジェクト名を設定して保存（Ctrl+S）',
      '実行ボタン（▶）をクリックして実行',
      '初回実行時は承認が必要です'
    ],
    notes: [
      'データが多い場合は処理に時間がかかることがあります',
      '1行目はヘッダー行として扱われます',
      '文字列の大小文字は区別されます'
    ]
  },
  calendar: {
    intro: 'スプレッドシートからGoogleカレンダーに予定を一括登録するコードを生成しました。',
    steps: [
      'スプレッドシートにイベントデータを準備（タイトル、開始日時、終了日時など）',
      'Apps Scriptエディタを開く',
      'コードを貼り付けて保存',
      'カレンダーIDを設定（カレンダー設定から確認）',
      'テスト実行して動作確認',
      'トリガーを設定して定期実行（必要に応じて）'
    ],
    notes: [
      'カレンダーへのアクセス権限が必要です',
      '大量のイベントを追加する場合はAPI制限に注意',
      '重複チェック機能を追加することを推奨'
    ]
  }
}