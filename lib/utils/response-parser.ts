export interface ParsedResponse {
  intro?: string
  code?: {
    language: string
    content: string
    hasCode: boolean
  }
  steps?: string[]
  notes?: string[]
  fallback?: string
}

// 構造化メッセージ表示用のパーサー（ClaudeのResponseParserとは別物）
export class MessageStructureParser {
  private patterns = {
    codeBlock: /```(\w+)?\s*([\s\S]*?)```/g,
    codeSection: /(?:コード[:：]?\s*\n)([\s\S]*?)(?=設定方法|注意点|手順|$)/i,
    steps: /(?:設定方法|手順)[:：]?\s*\n((?:[\d１-９][.．)].*?\n?)*)/gi,
    notes: /(?:注意点|備考|ポイント)[:：]?\s*\n((?:[•・※].*?\n?)*)/gi,
    numberedList: /^[\d１-９][.．)]\s*/,
    bulletList: /^[•・※]\s*/
  }

  parse(responseText: string): ParsedResponse {
    try {
      const intro = this.extractIntro(responseText)
      const code = this.extractCode(responseText)
      const steps = this.extractSteps(responseText)
      const notes = this.extractNotes(responseText)

      if (!code.hasCode && steps.length === 0 && notes.length === 0) {
        return { fallback: responseText }
      }

      return {
        intro,
        code,
        steps,
        notes
      }
    } catch (error) {
      console.error('Response parsing failed:', error)
      return { fallback: responseText }
    }
  }

  private extractIntro(text: string): string {
    const lines = text.split('\n')
    const firstLine = lines[0]?.trim() || ''
    
    // コード、設定方法、注意点で始まる場合は intro なし
    if (firstLine.match(/^(コード[:：]|設定方法[:：]|注意点[:：])/)) {
      return ''
    }
    
    // 最初の文または段落を intro として抽出
    const introEnd = text.search(/\n\n|コード[:：]|設定方法[:：]|注意点[:：]/)
    if (introEnd > 0) {
      return text.substring(0, introEnd).trim()
    }
    
    return firstLine
  }

  private extractCode(text: string): { language: string; content: string; hasCode: boolean } {
    // まず```で囲まれたコードブロックを探す
    const codeBlockMatch = text.match(/```(\w+)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      return {
        language: codeBlockMatch[1] || 'javascript',
        content: codeBlockMatch[2].trim(),
        hasCode: true
      }
    }

    // 「コード:」セクションを探す
    const codeSectionMatch = text.match(this.patterns.codeSection)
    if (codeSectionMatch) {
      const codeContent = codeSectionMatch[1].trim()
      // function や var などのキーワードを探してコードかどうか判定
      if (codeContent.match(/function\s+\w+|var\s+\w+|const\s+\w+|let\s+\w+/)) {
        return {
          language: 'javascript',
          content: codeContent,
          hasCode: true
        }
      }
    }

    return { language: 'javascript', content: '', hasCode: false }
  }

  private extractSteps(text: string): string[] {
    const steps: string[] = []
    
    // 「設定方法:」または「手順:」セクションを探す
    const stepsMatch = text.match(this.patterns.steps)
    if (stepsMatch) {
      const stepsText = stepsMatch[1]
      const lines = stepsText.split('\n').filter(line => line.trim())
      
      lines.forEach(line => {
        const cleanedLine = line.replace(this.patterns.numberedList, '').trim()
        if (cleanedLine) {
          steps.push(cleanedLine)
        }
      })
    }

    // 番号付きリストを探す（設定方法セクションがない場合）
    if (steps.length === 0) {
      const numberedLines = text.match(/^[\d１-９][.．)].*$/gm)
      if (numberedLines) {
        numberedLines.forEach(line => {
          const cleanedLine = line.replace(this.patterns.numberedList, '').trim()
          if (cleanedLine) {
            steps.push(cleanedLine)
          }
        })
      }
    }

    return steps
  }

  private extractNotes(text: string): string[] {
    const notes: string[] = []
    
    // 「注意点:」セクションを探す
    const notesMatch = text.match(this.patterns.notes)
    if (notesMatch) {
      const notesText = notesMatch[1]
      const lines = notesText.split('\n').filter(line => line.trim())
      
      lines.forEach(line => {
        const cleanedLine = line.replace(this.patterns.bulletList, '').trim()
        if (cleanedLine) {
          notes.push(cleanedLine)
        }
      })
    }

    // 箇条書きを探す（注意点セクションがない場合）
    if (notes.length === 0) {
      const bulletLines = text.match(/^[•・※].*$/gm)
      if (bulletLines && bulletLines.length > 0) {
        bulletLines.forEach(line => {
          const cleanedLine = line.replace(this.patterns.bulletList, '').trim()
          if (cleanedLine) {
            notes.push(cleanedLine)
          }
        })
      }
    }

    return notes
  }
}