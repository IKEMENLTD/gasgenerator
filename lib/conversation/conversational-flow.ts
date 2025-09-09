import { Anthropic } from '@anthropic-ai/sdk'
import { logger } from '../utils/logger'

// Anthropic SDKの型定義
interface AnthropicMessage {
  content: Array<{ text: string }>
}

// 型ガード関数
function isAnthropicMessage(obj: any): obj is AnthropicMessage {
  return obj && 
         Array.isArray(obj.content) && 
         obj.content.length > 0 && 
         typeof obj.content[0].text === 'string'
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

export interface ConversationContext {
  category: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  requirements: {
    purpose?: string
    currentProcess?: string
    desiredOutcome?: string
    constraints?: string[]
    dataStructure?: string
    frequency?: string
    [key: string]: string | string[] | undefined
  }
  readyForCode: boolean
  // 最後に生成したコード関連の情報
  lastGeneratedCode?: boolean
  lastGeneratedCategory?: string
  lastGeneratedRequirements?: Record<string, string | string[] | undefined>
  isModifying?: boolean
  isAddingDescription?: boolean
}

// カテゴリ別の質問テンプレート
const CATEGORY_QUESTIONS = {
  gmail: {
    initial: 'Gmail自動化を選択されました！\n\nどのような作業を自動化したいですか？\n\n例：\n- 特定の件名のメールを自動返信\n- 添付ファイルを自動保存\n- 定期的にメールを送信\n- メールの内容をスプレッドシートに記録',
    followUp: [
      '現在はどのような方法で処理していますか？',
      'どのくらいの頻度で実行したいですか？（毎日、週1回、メール受信時など）',
      '特別な条件はありますか？（特定の送信者、キーワードなど）'
    ]
  },
  spreadsheet: {
    initial: 'スプレッドシート操作を選択されました！\n\nどのようなデータ処理を自動化したいですか？\n\n例：\n- 売上データの集計\n- レポートの自動生成\n- データの転記や整形\n- グラフの自動作成',
    followUp: [
      'どのようなデータを扱いますか？（売上、在庫、顧客情報など）',
      '現在のシートの構成を教えてください（シート名、列の内容など）',
      'どのような結果を出力したいですか？'
    ]
  },
  calendar: {
    initial: 'カレンダー連携を選択されました！\n\nどのような予定管理を自動化したいですか？\n\n例：\n- 定期的な予定の自動作成\n- スプレッドシートから予定を一括登録\n- 予定のリマインダー送信\n- 参加者への自動通知',
    followUp: [
      '予定の作成頻度や周期を教えてください',
      '参加者への通知は必要ですか？',
      '他のツールとの連携は必要ですか？'
    ]
  },
  api: {
    initial: 'API連携を選択されました！\n\nどのようなサービスと連携したいですか？\n\n例：\n- Slack通知\n- LINE通知\n- 外部データベース連携\n- Webサービスからのデータ取得',
    followUp: [
      '連携したいサービス名を教えてください',
      'どのようなデータをやり取りしますか？',
      'APIキーやWebhook URLはお持ちですか？'
    ]
  },
  custom: {
    initial: 'その他の自動化を選択されました！\n\n実現したいことを自由に教えてください。\n\nどんな作業を効率化したいですか？',
    followUp: [
      '現在の作業フローを詳しく教えてください',
      '最も時間がかかっている部分はどこですか？',
      '理想的な自動化の形を教えてください'
    ]
  }
}

export class ConversationalFlow {
  /**
   * 会話から要件を抽出
   */
  private static extractRequirementsFromConversation(
    messages: Array<{role: string, content: string}>,
    latestReply: string
  ): Record<string, string | string[] | undefined> | null {
    const requirements: Record<string, string | string[] | undefined> = {}
    
    // 会話全体から要件を抽出するシンプルなロジック
    const allText = messages.map(m => m.content).join(' ') + ' ' + latestReply
    
    // スプレッドシート関連
    if (allText.includes('A列') || allText.includes('B列') || allText.includes('C列')) {
      requirements.columns = allText.match(/[A-Z]列/g)?.join(', ')
    }
    
    // 実行タイミング
    if (allText.includes('毎日') || allText.includes('毎週') || allText.includes('毎月')) {
      requirements.frequency = allText.match(/(毎日|毎週|毎月)/)?.[0]
    }
    
    // 時刻
    const timeMatch = allText.match(/(\d{1,2}時)/g)
    if (timeMatch) {
      requirements.executionTime = timeMatch[0]
    }
    
    // 処理内容
    if (allText.includes('集計')) requirements.action = '集計'
    if (allText.includes('転記')) requirements.action = '転記'
    if (allText.includes('比較')) requirements.action = '比較'
    if (allText.includes('メール')) requirements.action = 'メール送信'
    
    return Object.keys(requirements).length > 0 ? requirements : null
  }
  /**
   * AIを使った会話的な要件収集
   */
  static async processConversation(
    context: ConversationContext,
    userMessage: string
  ): Promise<{
    reply: string
    isComplete: boolean
    updatedContext: ConversationContext
  }> {
    // 会話履歴に追加
    context.messages.push({
      role: 'user',
      content: userMessage
    })

    // 初回メッセージの場合
    if (context.messages.length === 1) {
      const categoryKey = context.category as keyof typeof CATEGORY_QUESTIONS
      const initial = CATEGORY_QUESTIONS[categoryKey]?.initial || CATEGORY_QUESTIONS.custom.initial
      
      context.messages.push({
        role: 'assistant',
        content: initial
      })
      
      return {
        reply: initial,
        isComplete: false,
        updatedContext: context
      }
    }

    // AIで会話を分析して次の質問を生成
    try {
      const systemPrompt = `あなたは優秀なGoogle Apps Script（GAS）コード生成アシスタントです。
カテゴリ: ${context.category}

ユーザーの要望を理解して自然に対話してください。

重要な指示:
1. ユーザーの要望の本質を理解することを最優先にしてください
2. 不明な点があれば、具体的で分かりやすい質問をしてください  
3. ユーザーが「勤怠管理」「請求書作成」など具体的な目的を伝えた場合、それを最優先に理解してください
4. 会話の文脈を常に考慮し、前の会話内容を忘れないでください
5. 必要な情報が十分に集まったら、返答の最後に「[READY_FOR_CODE]」というマーカーを付けてください

返答の構造:
- 自然な日本語での返信を行ってください
- 要件が集まった場合は、最後に「[READY_FOR_CODE]」を追加
- 収集した要件は会話の中で自然に確認してください

例:
「スプレッドシートのA列とB列を比較して、一致するデータをC列に出力する処理ですね。
毎日自動実行する必要はありますか？それとも手動実行で問題ないでしょうか？」

または要件が揃った場合:
「承知しました。毎日朝9時に自動実行して、A列とB列を比較し、一致データをC列に出力するコードを生成します。
[READY_FOR_CODE]」`

      const conversationHistory = context.messages
        .map(m => `${m.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${m.content}`)
        .join('\n\n')

      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        temperature: 0.7,  // 自然な会話のために温度を上げる
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `これまでの会話:
${conversationHistory}

ユーザーの最新の発言を踏まえて、自然な日本語で返答してください。
必要な情報が十分に集まったら、返答の最後に [READY_FOR_CODE] を追加してください。`
        }]
      })

      // 型安全なキャスト
      if (!isAnthropicMessage(response)) {
        throw new Error('Invalid response format from Anthropic API')
      }
      const responseText = response.content[0].text
      
      // 自然言語での処理に変更
      const aiReply = responseText.trim()
      const isReadyForCode = aiReply.includes('[READY_FOR_CODE]')
      
      // マーカーを除去した返信テキスト
      let cleanReply = aiReply.replace('[READY_FOR_CODE]', '').trim()
      
      // 要件の抽出（会話から自然に抽出）
      const extractedRequirements = this.extractRequirementsFromConversation(
        context.messages,
        cleanReply
      )
      
      // 要件を更新
      if (extractedRequirements) {
        context.requirements = {
          ...context.requirements,
          ...extractedRequirements
        }
      }

      // 会話履歴に追加
      context.messages.push({
        role: 'assistant',
        content: cleanReply
      })

      // 要件収集が完了した場合
      if (isReadyForCode) {
        context.readyForCode = true
        const confirmMessage = `\n\n📝 要件を確認させていただきます：\n\n${Object.entries(context.requirements)
          .filter(([k, v]) => v)
          .map(([k, v]) => `・${k}: ${v}`)
          .join('\n')}\n\nこの内容でコードを生成してよろしいですか？\n\n「はい」または「修正」とお答えください。`
        
        cleanReply += confirmMessage
      }

      return {
        reply: cleanReply,
        isComplete: isReadyForCode,
        updatedContext: context
      }

    } catch (error) {
      logger.error('AI conversation error', { error })
      
      // エラー時の返答
      const errorReply = '申し訳ございません。エラーが発生しました。もう一度お試しください。\n\nお困りの場合は、具体的にどのような作業を自動化したいか教えていただければ、お手伝いさせていただきます。'
      context.messages.push({
        role: 'assistant',
        content: errorReply
      })
      
      return {
        reply: errorReply,
        isComplete: false,
        updatedContext: context
      }
    }
  }

  /**
   * 要件からプロンプトを生成
   */
  static generateCodePrompt(context: ConversationContext): string {
    const conversation = context.messages
      .map(m => `${m.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${m.content}`)
      .join('\n')

    return `以下の会話から要件を理解し、Google Apps Scriptのコードを生成してください。

カテゴリ: ${context.category}

会話内容:
${conversation}

収集した要件:
${JSON.stringify(context.requirements, null, 2)}

要求:
1. 完全に動作するGASコードを生成
2. エラーハンドリングを含める
3. コメントで処理を説明
4. 必要な権限や設定を説明に含める
5. テスト方法も説明する`
  }

  /**
   * 会話をリセット
   */
  static resetConversation(category: string): ConversationContext {
    return {
      category,
      messages: [],
      requirements: {},
      readyForCode: false
    }
  }
}