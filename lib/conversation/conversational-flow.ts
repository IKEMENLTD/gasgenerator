import { Anthropic } from '@anthropic-ai/sdk'
import { logger } from '../utils/logger'
import { AIRequirementsExtractor } from './ai-requirements-extractor'

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
  sessionId?: string
  userId?: string  // AI要件抽出用に追加
  category: string
  subcategory?: string
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
  extractedRequirements?: Record<string, any>
  readyForCode: boolean
  // 最後に生成したコード関連の情報
  lastGeneratedCode?: boolean
  lastGeneratedCategory?: string
  lastGeneratedRequirements?: Record<string, string | string[] | undefined>
  isModifying?: boolean
  isAddingDescription?: boolean
  waitingForScreenshot?: boolean
  waitingForConfirmation?: boolean
  imageContent?: string
  errorScreenshot?: string
  currentStep?: number
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
    
    // 会話全体から要件を抽出
    const allText = messages.map(m => m.content).join(' ') + ' ' + latestReply
    const userText = messages.filter(m => m.role === 'user').map(m => m.content).join(' ')

    // グラフ関連（優先度高）
    if (allText.includes('グラフ') || allText.includes('チャート') || allText.includes('chart') || allText.includes('graph')) {
      requirements['処理種別'] = 'グラフ作成'
      // グラフの種類
      if (allText.includes('棒グラフ') || allText.includes('棒')) {
        requirements['グラフタイプ'] = '棒グラフ'
      } else if (allText.includes('円グラフ') || allText.includes('円')) {
        requirements['グラフタイプ'] = '円グラフ'
      } else if (allText.includes('折れ線')) {
        requirements['グラフタイプ'] = '折れ線グラフ'
      }
    }

    // スプレッドシート関連
    if (allText.includes('スプレッドシート') || allText.includes('シート') || allText.includes('sheet')) {
      // 列の指定
      const columnMatch = allText.match(/[A-Z]列/g)
      if (columnMatch) {
        requirements['対象列'] = columnMatch.join(', ')
      }
      // シート名
      const sheetMatch = allText.match(/「([^」]+)」/g)
      if (sheetMatch) {
        requirements['シート名'] = sheetMatch.map(s => s.replace(/[「」]/g, '')).join(', ')
      }
    }

    // データ処理関連
    if (allText.includes('集計') || allText.includes('合計') || allText.includes('平均')) {
      requirements['処理内容'] = 'データ集計'
    } else if (allText.includes('転記') || allText.includes('コピー')) {
      requirements['処理内容'] = 'データ転記'
    } else if (allText.includes('抜き出') || allText.includes('抽出')) {
      requirements['処理内容'] = 'データ抽出'
    } else if (allText.includes('比較')) {
      requirements['処理内容'] = 'データ比較'
    }

    // 実行タイミング
    if (allText.includes('毎日') || allText.includes('毎週') || allText.includes('毎月')) {
      requirements['実行頻度'] = allText.match(/(毎日|毎週|毎月)/)?.[0]
    }

    // 時刻
    const timeMatch = allText.match(/(\d{1,2}時)/g)
    if (timeMatch) {
      requirements['実行時刻'] = timeMatch[0]
    }

    // ユーザーの具体的な要求を抽出
    const requestPatterns = [
      /([^。、]+(?:したい|してください|してほしい|お願い))/g,
      /([^。、]+(?:できる|できますか))/g,
      /([^。、]+を(?:作る|作成|生成))/g
    ]

    for (const pattern of requestPatterns) {
      const matches = userText.match(pattern)
      if (matches) {
        requirements['ユーザー要求'] = matches.join('、')
        break
      }
    }

    // 要件が空の場合、ユーザーの最新メッセージをそのまま保存
    if (Object.keys(requirements).length === 0 && userText.length > 0) {
      requirements['ユーザー入力'] = userText.substring(0, 200)
    }

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
      
      // AIを使って要件を抽出（LLMに完全に任せる）
      try {
        const aiExtracted = await AIRequirementsExtractor.extractFromConversation(
          context.messages,
          context.userId  // userIdのみを渡す（userInputは間違い）
        )

        // 要件を構造化して保存（空白対策を強化）
        context.requirements = {
          '主要目的': aiExtracted.mainPurpose || '要件を確認中です',
          'データソース': aiExtracted.dataSource || '未指定',
          '処理タイプ': aiExtracted.processingType || '未指定',
          '出力形式': aiExtracted.outputFormat || '未指定',
          '実行タイミング': aiExtracted.schedule || '手動実行',
          '詳細要件': (aiExtracted.specificRequirements && aiExtracted.specificRequirements.length > 0)
            ? aiExtracted.specificRequirements.join('、')
            : '詳細確認中',
          'AI理解度': `${aiExtracted.confidenceLevel || 50}%`
        }

        // 理解度が低い場合は追加質問
        if (aiExtracted.confidenceLevel < 70 && !isReadyForCode) {
          const missingInfo = AIRequirementsExtractor.identifyMissingInfo(aiExtracted)
          if (missingInfo.length > 0) {
            const smartQuestion = await AIRequirementsExtractor.generateSmartQuestion(
              missingInfo,
              aiExtracted
            )
            cleanReply += `\n\n${smartQuestion}`
          }
        }

        logger.info('AI requirements extraction successful', {
          confidence: aiExtracted.confidenceLevel,
          mainPurpose: aiExtracted.mainPurpose
        })

      } catch (extractError) {
        logger.error('AI extraction failed, falling back to old method', { extractError })

        // フォールバック：古い方法を使用
        const extractedRequirements = this.extractRequirementsFromConversation(
          context.messages,
          cleanReply
        )

        if (extractedRequirements && Object.keys(extractedRequirements).length > 0) {
          context.requirements = {
            ...context.requirements,
            ...extractedRequirements
          }
        } else {
          // 完全にフォールバック：最低限の要件を設定（より親切に）
          context.requirements = {
            '主要目的': userInput.substring(0, 100),
            'データソース': 'どのシートやファイルを使うか教えてください',
            '処理タイプ': 'どんな処理をしたいか詳しく教えてください',
            '出力形式': '結果の出力先を教えてください',
            '実行タイミング': '手動実行を予定',
            '詳細要件': 'もう少し詳しくお聞かせください',
            'AI理解度': '追加情報が必要です'
          }
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

        // 要件が空または不十分な場合の処理
        if (!context.requirements || Object.keys(context.requirements).length === 0) {
          // 会話履歴から要件を再構築
          const userMessages = context.messages
            .filter(m => m.role === 'user')
            .map(m => m.content)

          if (userMessages.length > 0) {
            context.requirements = {
              'ユーザー要求': userMessages.join('、'),
              'AI理解内容': cleanReply.substring(0, 150)
            }
          }
        }

        // 要件リストの作成（簡潔版）
        const requirementEntries = Object.entries(context.requirements)
          .filter(([k, v]) => v && k !== 'AI理解度' && k !== '詳細要件')
          .slice(0, 3) // 最大3項目

        if (requirementEntries.length > 0) {
          const mainPurpose = context.requirements['主要目的'] || requirementEntries[0]?.[1] || '要件確認中'

          // 1行で完結する確認メッセージ
          const confirmMessage = `\n\n✅ 「${mainPurpose}」を実現するコードを生成します。\n\nよろしければ「はい」、変更があれば内容をお知らせください。`
          cleanReply += confirmMessage
        } else {
          // 万が一要件が全く取得できない場合
          const confirmMessage = `\n\n✅ ご要望に沿ったコードを生成します。\n\n「はい」で続行、追加要望があればお知らせください。`
          cleanReply += confirmMessage
        }
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