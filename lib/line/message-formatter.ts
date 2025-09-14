/**
 * LINE メッセージフォーマッター
 * 長いコードの分割と、コードブロックのフォーマットを行う
 */
export class MessageFormatter {
  // LINEの1メッセージの実際の最大文字数は2000文字
  // 安全マージンを設けて1800文字で分割
  private static readonly CHUNK_SIZE = 1800
  // コードブロックの最大文字数（少し小さめに）
  private static readonly MAX_CODE_BLOCK_SIZE = 1500

  /**
   * コードをフォーマットして、黒背景のコードブロックとして表示
   */
  static formatCode(code: string, language: string = ''): string {
    // LINEでは完全な黒背景は不可能だが、コードブロック記法を使用
    // バッククォート3つで囲むことでコードブロックとして表示
    return `\`\`\`${language}\n${code}\n\`\`\``
  }

  /**
   * 長いメッセージを複数のメッセージに分割
   */
  static splitLongMessage(text: string): string[] {
    // コードブロックを検出して特別に処理
    const codeBlockRegex = /```[\s\S]*?```/g
    const codeBlocks = text.match(codeBlockRegex) || []
    
    // テキスト全体が短い場合はそのまま返す
    if (text.length <= this.CHUNK_SIZE && codeBlocks.length === 0) {
      return [text]
    }

    const messages: string[] = []
    
    // コードブロックが含まれている場合
    if (codeBlocks.length > 0) {
      let lastIndex = 0
      
      for (const codeBlock of codeBlocks) {
        const blockIndex = text.indexOf(codeBlock, lastIndex)
        
        // コードブロック前のテキスト
        const beforeText = text.substring(lastIndex, blockIndex)
        if (beforeText) {
          const splitBefore = this.splitPlainText(beforeText)
          for (const chunk of splitBefore) {
            messages.push(chunk)
          }
        }
        
        // コードブロック自体を処理
        if (codeBlock.length > this.MAX_CODE_BLOCK_SIZE) {
          // 大きなコードブロックを分割
          const splitCode = this.splitCodeBlock(codeBlock)
          for (const chunk of splitCode) {
            messages.push(chunk)
          }
        } else {
          messages.push(codeBlock)
        }
        
        lastIndex = blockIndex + codeBlock.length
      }
      
      // 最後の残りテキスト
      if (lastIndex < text.length) {
        const remainingText = text.substring(lastIndex)
        const splitRemaining = this.splitPlainText(remainingText)
        for (const chunk of splitRemaining) {
          messages.push(chunk)
        }
      }
    } else {
      // コードブロックがない場合は通常の分割
      return this.splitPlainText(text)
    }
    
    return messages.filter(msg => msg.trim().length > 0)
  }

  /**
   * プレーンテキストを分割
   */
  private static splitPlainText(text: string): string[] {
    if (text.length <= this.CHUNK_SIZE) {
      return [text]
    }

    const messages: string[] = []
    const lines = text.split('\n')
    let currentChunk = ''

    for (const line of lines) {
      // 行自体が長すぎる場合
      if (line.length > this.CHUNK_SIZE) {
        // 現在のチャンクを保存
        if (currentChunk) {
          messages.push(currentChunk)
          currentChunk = ''
        }
        
        // 長い行を分割
        const words = line.split(' ')
        let currentLine = ''
        
        for (const word of words) {
          if (currentLine.length + word.length + 1 > this.CHUNK_SIZE) {
            if (currentLine) {
              messages.push(currentLine)
            }
            currentLine = word
          } else {
            currentLine = currentLine ? `${currentLine} ${word}` : word
          }
        }
        
        if (currentLine) {
          currentChunk = currentLine
        }
      } else {
        // 通常の行
        if (currentChunk.length + line.length + 1 > this.CHUNK_SIZE) {
          messages.push(currentChunk)
          currentChunk = line
        } else {
          currentChunk = currentChunk ? `${currentChunk}\n${line}` : line
        }
      }
    }

    // 最後のチャンクを追加
    if (currentChunk) {
      messages.push(currentChunk)
    }

    return messages
  }

  /**
   * コードブロックを分割
   */
  private static splitCodeBlock(codeBlock: string): string[] {
    // コードブロックの開始と終了を取得
    const lines = codeBlock.split('\n')
    const startLine = lines[0] // ```language
    const endLine = '```'
    const codeLines = lines.slice(1, -1) // コード本体
    
    const messages: string[] = []
    let currentChunk: string[] = []
    let currentSize = 0
    let partNumber = 1
    const totalParts = Math.ceil(codeLines.join('\n').length / this.MAX_CODE_BLOCK_SIZE)

    for (const line of codeLines) {
      if (currentSize + line.length + 1 > this.MAX_CODE_BLOCK_SIZE) {
        // 現在のチャンクを保存
        if (currentChunk.length > 0) {
          const header = totalParts > 1 ? `📄 コード (${partNumber}/${totalParts})\n` : ''
          messages.push(header + startLine + '\n' + currentChunk.join('\n') + '\n' + endLine)
          partNumber++
        }
        currentChunk = [line]
        currentSize = line.length
      } else {
        currentChunk.push(line)
        currentSize += line.length + 1
      }
    }

    // 最後のチャンクを追加
    if (currentChunk.length > 0) {
      const header = totalParts > 1 ? `📄 コード (${partNumber}/${totalParts})\n` : ''
      messages.push(header + startLine + '\n' + currentChunk.join('\n') + '\n' + endLine)
    }

    return messages
  }

  /**
   * GASコード出力用の特別なフォーマット
   */
  static formatGASCode(code: string, description?: string): string[] {
    const messages: string[] = []
    
    // 説明文がある場合は最初に追加
    if (description) {
      messages.push(`📝 ${description}`)
    }

    // コードをフォーマット
    const formattedCode = this.formatCode(code, 'javascript')
    
    // コードが長い場合は分割
    if (formattedCode.length > this.MAX_CODE_BLOCK_SIZE) {
      const splitCode = this.splitCodeBlock(formattedCode)
      messages.push(...splitCode)
    } else {
      messages.push(formattedCode)
    }

    // 使用方法を追加
    messages.push(
      '💡 使用方法:\n' +
      '1. Google Apps Script を開く\n' +
      '2. 上記コードをコピー＆ペースト\n' +
      '3. 保存して実行'
    )

    return messages
  }

  /**
   * エラーメッセージのフォーマット
   */
  static formatError(error: string, solution?: string): string {
    let message = `⚠️ エラーが発生しました:\n\n${error}`
    
    if (solution) {
      message += `\n\n💡 解決方法:\n${solution}`
    }
    
    return message
  }

  /**
   * 成功メッセージのフォーマット
   */
  static formatSuccess(message: string, code?: string): string[] {
    const messages: string[] = []
    
    messages.push(`✅ ${message}`)
    
    if (code) {
      const codeMessages = this.formatGASCode(code)
      messages.push(...codeMessages)
    }
    
    return messages
  }
}