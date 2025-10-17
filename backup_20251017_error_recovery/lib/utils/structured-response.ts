import { MessageStructureParser, ParsedResponse } from './response-parser'
import { FlexCodeTemplate } from '../line/flex-code-template'
import { logger } from './logger'

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
      logger.error('Failed to format structured response:', { error })
      // エラー時は単純なテキストメッセージとして返す
      return this.createFallbackMessages(responseText)
    }
  }

  private createStructuredMessages(parsed: ParsedResponse): Message[] {
    // Flex Messageを使用してリッチなコード表示
    if (parsed.code?.hasCode && parsed.code.content) {
      const flexMessage = FlexCodeTemplate.createCodeMessage(
        parsed.code.content,
        parsed.steps || this.getDefaultSteps(),
        parsed.notes || this.getDefaultNotes(),
        true // エンジニア相談ボタンを含める
      )
      
      // Flex Messageを含む配列を返す
      return [flexMessage as any]
    }
    
    // フォールバック: 従来のメッセージ形式
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
    
    // コードヘッダー（簡潔に）
    messages.push({
      type: 'text',
      text: `🎆 GAS コードを自動生成しました！`
    })

    // コードブロック（黒背景風に見せるための装飾）
    if (code.content.length <= 2000) {
      // 黒背景風の装飾を追加
      const decoratedCode = this.decorateCode(code.content)
      messages.push({
        type: 'text',
        text: `コード：\n════════════════════\n🖥️\n\`\`\`javascript\n${decoratedCode}\n\`\`\`\n════════════════════`
      })
    } else {
      const chunks = this.splitCode(code.content, 1500)
      chunks.forEach((chunk, index) => {
        const decoratedChunk = this.decorateCode(chunk)
        messages.push({
          type: 'text',
          text: `[パート ${index + 1}/${chunks.length}]\n════════════════\n\`\`\`javascript\n${decoratedChunk}\n\`\`\`\n════════════════`
        })
      })
    }

    return messages
  }

  private createStepsMessage(steps: string[]): Message {
    const stepsList = steps.map((step, index) => {
      // 大きい数字と絵文字で見やすく
      const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
      const emoji = numberEmojis[index] || `${index + 1}.`
      return `${emoji} ${step}`
    }).join('\n\n')

    return {
      type: 'text',
      text: `📖 設定方法：\n\n${stepsList}`
    }
  }

  private createNotesMessage(notes: string[]): Message {
    const notesList = notes.map(note => `• ${note}`).join('\n')

    return {
      type: 'text',
      text: `⚠️ 注意点：\n\n${notesList}\n\nコピーする`
    }
  }

  private createActionButtons(): Message {
    return {
      type: 'template',
      altText: 'コード生成完了',
      template: {
        type: 'buttons',
        text: '✅ コード生成が完了しました！\n\n何かお困りの点がございましたらお気軽にご連絡ください。',
        actions: [
          {
            type: 'message',
            label: '🔧 コードを修正',
            text: 'コードを修正したい'
          },
          {
            type: 'message',
            label: '👨‍💻 エンジニアに相談',
            text: 'エンジニアに相談する'
          },
          {
            type: 'message',
            label: '❓ 使い方を確認',
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

  private decorateCode(code: string): string {
    // コードの先頭にコメントを追加（黒背景で見やすくするため）
    const lines = code.split('\n')
    if (!lines[0].includes('//')) {
      lines.unshift('// ✨ GASコードを自動生成しました')
    }
    return lines.join('\n')
  }

  private getDefaultSteps(): string[] {
    return [
      'Google スプレッドシートを開く',
      '拡張機能 > Apps Script をクリック',
      'コードをコピーして貼り付け',
      '保存して実行'
    ]
  }

  private getDefaultNotes(): string[] {
    return [
      '初回実行時は承認が必要です',
      'エラーが出た場合は画面をスクショして送信してください'
    ]
  }

}

// 構造化レスポンスのサンプルテンプレート
export const STRUCTURED_TEMPLATES = {
  spreadsheet: {
    intro: 'スプレッドシートのA列とB列を比較してC列にチェックを入れるGAS（Google Apps Script）を記述します。',
    steps: [
      'スプレッドシートを開く：対象のスプレッドシートを開きます',
      'スクリプトエディタを開く：「ツール」>「スクリプトエディタ」を選択します',
      'コードを貼り付ける：スクリプトエディタに上記のコードをコピー＆ペーストします',
      '保存：スクリプトを保存します（例：checkColumns）',
      '実行：スクリプトエディタの左側にある「実行」ボタンをクリックします',
      '実行する関数：checkColumns を選択し、「実行」ボタンをクリックします',
      'イベントシートから実行時間にスプレッドシートのセルに変更が反映されます'
    ],
    notes: [
      '上記のコードは、A列とB列の値が同じ場合、C列に「TRUE」を入力します',
      '1行目はヘッダー行として考え、スキップします。もしヘッダーがない場合は、for文の初期値を「i = 0」に変更してください',
      'トリガーを設定すると、スプレッドシートが編集されるたびに自動的にスクリプトが実行されます',
      '必要に応じて、setValue(\"TRUE\")とsetValue(\"FALSE\")の部分を、チェックボックスやその他の文字列に変更してください'
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