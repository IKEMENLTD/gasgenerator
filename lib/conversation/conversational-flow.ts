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
      const systemPrompt = `You are a GAS code assistant. Category: ${context.category}

CRITICAL: Output ONLY valid JSON. No explanations, no text before/after.

Response format:
{
  "reply": "Your response in Japanese",
  "requirements": {"key": "value"},
  "requirement_complete": false
}

Guidelines:
- Ask 1-2 questions in Japanese
- Extract requirements from user messages
- Set requirement_complete to true when ready
- ONLY output JSON, nothing else`

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

必ず以下のJSON形式で返答してください（日本語のメッセージ部分以外は英語で記述）：
{
  "reply": "ユーザーへの返信メッセージ（日本語）",
  "requirements": {
    "収集した要件のキー": "値"
  },
  "requirement_complete": false
}

重要：返答全体を有効なJSONとして返してください。JSONのみを返し、他のテキストは含めないでください。`
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
          reply: 'もう少し詳しく教えていただけますか？どのような処理を自動化したいですか？',
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
      
      // フォールバック：事前定義の質問を使用
      const categoryKey = context.category as keyof typeof CATEGORY_QUESTIONS
      const questions = CATEGORY_QUESTIONS[categoryKey]?.followUp || []
      const questionIndex = Math.min(context.messages.length / 2 - 1, questions.length - 1)
      
      if (questionIndex >= 0 && questions[questionIndex]) {
        const reply = questions[questionIndex]
        context.messages.push({
          role: 'assistant',
          content: reply
        })
        
        return {
          reply,
          isComplete: false,
          updatedContext: context
        }
      }
      
      // デフォルトの返答
      const defaultReply = 'もう少し詳しく教えていただけますか？どのような処理を自動化したいですか？'
      context.messages.push({
        role: 'assistant',
        content: defaultReply
      })
      
      return {
        reply: defaultReply,
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