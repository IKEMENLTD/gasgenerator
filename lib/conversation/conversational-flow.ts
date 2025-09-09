import { Anthropic } from '@anthropic-ai/sdk'

// Anthropic SDKの型定義
interface AnthropicMessage {
  content: Array<{ text: string }>
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
    [key: string]: any
  }
  readyForCode: boolean
  // 最後に生成したコード関連の情報
  lastGeneratedCode?: boolean
  lastGeneratedCategory?: string
  lastGeneratedRequirements?: any
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
5. 必要な情報が集まったと判断したら、requirement_completeをtrueにしてください

返答形式（JSONで返してください）:
{
  "reply": "ユーザーへの自然な日本語での返信",
  "requirements": {
    "収集した要件のキー": "値"
  },
  "requirement_complete": false または true
}`

      const conversationHistory = context.messages
        .map(m => `${m.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${m.content}`)
        .join('\n\n')

      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        temperature: 0.1,  // 低温度で一貫したJSON出力
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `これまでの会話:
${conversationHistory}

次の返答を生成してください。
要件が十分に集まった場合は、最後に「requirement_complete: true」を追加してください。

現在のユーザーの要望を踏まえて、適切な返答を生成してください。
要件が十分に集まったと判断した場合は、requirement_completeをtrueにしてください。

注意: 返答はJSON形式で、追加のテキストは含めないでください。`
        }]
      })

      const responseText = (response as any).content[0].text
      
      // JSONパースのエラーハンドリング
      let aiResponse: any
      try {
        // レスポンスがJSONかチェック
        const trimmedText = responseText.trim()
        if (!trimmedText.startsWith('{')) {
          // JSON形式でない場合は、デフォルトレスポンスを作成
          console.warn('Non-JSON response from Claude:', trimmedText.substring(0, 100))
          aiResponse = {
            reply: trimmedText,
            requirements: {},
            requirement_complete: false
          }
        } else {
          aiResponse = JSON.parse(trimmedText)
        }
      } catch (parseError) {
        console.error('AI response parse error:', parseError)
        // パースエラー時のフォールバック
        aiResponse = {
          reply: '申し訳ございません。エラーが発生しました。もう一度お試しください。',
          requirements: {},
          requirement_complete: false
        }
      }
      
      // 要件を更新
      if (aiResponse.requirements) {
        context.requirements = {
          ...context.requirements,
          ...aiResponse.requirements
        }
      }

      // 会話履歴に追加
      context.messages.push({
        role: 'assistant',
        content: aiResponse.reply
      })

      // 要件収集が完了した場合
      if (aiResponse.requirement_complete) {
        context.readyForCode = true
        const confirmMessage = `\n\n📝 要件を確認させていただきます：\n\n${Object.entries(context.requirements)
          .filter(([k, v]) => v)
          .map(([k, v]) => `・${k}: ${v}`)
          .join('\n')}\n\nこの内容でコードを生成してよろしいですか？\n\n「はい」または「修正」とお答えください。`
        
        aiResponse.reply += confirmMessage
      }

      return {
        reply: aiResponse.reply,
        isComplete: aiResponse.requirement_complete || false,
        updatedContext: context
      }

    } catch (error) {
      console.error('AI conversation error:', error)
      
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