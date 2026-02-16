/**
 * AI相談機能（システム推薦）API
 *
 * GET  /api/system-recommendation - 5つの質問を取得
 * POST /api/system-recommendation - ユーザー回答を元にClaude APIで推薦分析
 *
 * 2026-02-16: 初版作成
 */

import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { logger } from '@/lib/utils/logger'
import { AIProviderManager } from '@/lib/ai/provider'
import {
  generateRecommendationPrompt,
  parseRecommendationResponse,
} from '@/lib/ai/recommendation-prompt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 5つの質問定義
interface Question {
  id: number
  text: string
  options: string[]
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    text: '御社の業種を選択してください',
    options: [
      '小売業',
      '飲食業',
      'サービス業',
      '士業（税理士・社労士等）',
      '建設業',
      'EC/通販',
      'BtoB企業',
      'IT企業',
      'その他',
    ],
  },
  {
    id: 2,
    text: '最も課題を感じている業務は何ですか？',
    options: [
      '在庫管理',
      '顧客管理',
      '期限管理',
      '経費精算',
      'シフト管理',
      '請求書作成',
      '売上分析',
      '工数管理',
      'その他',
    ],
  },
  {
    id: 3,
    text: '月間のお客様の数はどのくらいですか？',
    options: ['0〜50', '50〜200', '200〜500', '500以上'],
  },
  {
    id: 4,
    text: '月に何時間削減したいですか？',
    options: ['10時間', '20時間', '40時間', '80時間以上'],
  },
  {
    id: 5,
    text: '予算感はどのくらいですか？',
    options: ['月額1万円', '月額3万円', '月額5万円', '月額10万円以上'],
  },
]

/**
 * GET /api/system-recommendation
 * 5つの質問を返す
 */
export async function GET(request: NextRequest) {
  try {
    // セッションID生成
    const sessionId = nanoid()

    logger.info('System recommendation questions fetched', { sessionId })

    return NextResponse.json({
      success: true,
      sessionId,
      questions: QUESTIONS,
    })
  } catch (error) {
    logger.error('Failed to fetch recommendation questions', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch questions' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/system-recommendation
 * ユーザーの回答を元にClaude APIで推薦分析
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, answers } = body

    // バリデーション
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(answers) || answers.length !== 5) {
      return NextResponse.json(
        { success: false, error: 'answers must be an array of 5 items' },
        { status: 400 }
      )
    }

    // 回答データを整形
    const userAnswers = {
      industry: answers.find((a: any) => a.questionId === 1)?.answer || '',
      challenge: answers.find((a: any) => a.questionId === 2)?.answer || '',
      customerCount: answers.find((a: any) => a.questionId === 3)?.answer || '',
      timeSavingGoal: answers.find((a: any) => a.questionId === 4)?.answer || '',
      budget: answers.find((a: any) => a.questionId === 5)?.answer || '',
    }

    logger.info('System recommendation request', {
      sessionId,
      userAnswers,
    })

    // システムデータを取得（app/systems/catalog/page.tsxから）
    // TODO: 本来はDBまたは専用ファイルから取得すべきだが、初期実装では直接インポート
    const systems = await getSystemsData()

    // Claude API用プロンプト生成
    const prompt = generateRecommendationPrompt(systems, userAnswers)

    logger.info('Generated recommendation prompt', {
      sessionId,
      promptLength: prompt.length,
    })

    // Claude APIで推薦分析（AIProviderManager使用）
    const aiProvider = AIProviderManager.getInstance()
    const response = await aiProvider.sendMessage(
      [
        {
          role: 'user',
          content: prompt,
        },
      ],
      {
        maxTokens: 2000,
        temperature: 0.7,
        timeout: 45000, // 45秒
      }
    )

    // DEBUG: レスポンスオブジェクトの構造を確認
    logger.info('DEBUG: Response object', {
      sessionId,
      responseKeys: Object.keys(response),
      hasText: 'text' in response,
      hasContent: 'content' in response,
      contentType: response.content ? typeof response.content : 'undefined',
      contentIsArray: Array.isArray(response.content),
    })

    // レスポンスからテキストを取得
    let responseText: string
    if (response.text) {
      responseText = response.text
    } else if (response.content) {
      // content が配列の場合（Anthropic形式）
      if (Array.isArray(response.content)) {
        responseText = response.content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('\n')
      } else if (typeof response.content === 'string') {
        responseText = response.content
      } else {
        responseText = JSON.stringify(response.content)
      }
    } else {
      responseText = JSON.stringify(response)
    }

    logger.info('Claude API response received', {
      sessionId,
      provider: response.provider,
      responseLength: responseText.length,
    })

    // DEBUG: Claudeの生レスポンスを出力（最初の500文字）
    logger.info('DEBUG: Claude raw response (first 500 chars)', {
      sessionId,
      responseText: responseText.substring(0, 500),
    })

    // レスポンスをパース
    const recommendation = parseRecommendationResponse(responseText)

    if (!recommendation) {
      logger.error('Failed to parse recommendation response', {
        sessionId,
        responseText: response.text,
      })
      return NextResponse.json(
        { success: false, error: 'Failed to generate recommendations' },
        { status: 500 }
      )
    }

    logger.info('System recommendation completed', {
      sessionId,
      recommendations: recommendation.recommendations.map((r) => r.systemId),
    })

    // 成功レスポンス
    return NextResponse.json({
      success: true,
      sessionId,
      ...recommendation,
    })
  } catch (error) {
    logger.error('System recommendation error', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * システムデータ取得
 * TODO: 本来は専用ファイルまたはDBから取得
 * 初期実装では app/systems/catalog/page.tsx のデータを再利用
 */
async function getSystemsData(): Promise<any[]> {
  // app/systems/catalog/page.tsx の systems 配列をここに貼り付け
  // または require/import で読み込む（ただし Client Component のため工夫が必要）

  // 暫定: ハードコードで39システムを定義
  // 本実装では page.tsx から export して import する
  const systems = [
    {
      id: '01',
      name: '営業日報システム',
      tagline: '日報入力・週報月報自動生成',
      tags: ['日報管理', '自動集計', 'GAS連携', 'Soft UI'],
    },
    {
      id: '02',
      name: '失客アラートシステム',
      tagline: '顧客の失客リスクを自動検知・通知',
      tags: ['失客検知', '自動通知', '顧客管理', 'リスク分析'],
    },
    {
      id: '03',
      name: '期限管理システム',
      tagline: '届出期限の一元管理・アラート通知',
      tags: ['期限管理', 'アラート通知', '顧客管理', 'ダッシュボード'],
    },
    {
      id: '04',
      name: 'リピート促進メールシステム',
      tagline: '来店後フォローアップの自動化',
      tags: ['リピート促進', '自動メール', '顧客フォロー', 'テンプレート管理'],
    },
    {
      id: '05',
      name: '口コミ依頼自動化システム',
      tagline: '口コミ依頼の自動送信・管理',
      tags: ['口コミ依頼', '自動送信', '顧客管理', 'レビュー促進'],
    },
    {
      id: '06',
      name: '客単価分析＋アップセル提案',
      tagline: '購買データ分析・提案自動生成',
      tags: ['客単価分析', 'アップセル', 'クロスセル', '購買分析'],
    },
    {
      id: '07',
      name: '納期アラートシステム',
      tagline: '案件の納期を一元管理・アラート通知',
      tags: ['納期管理', 'アラート通知', '案件管理', 'ダッシュボード'],
    },
    {
      id: '08',
      name: '必須タスクチェックリスト',
      tagline: 'テンプレートから漏れなくタスク管理',
      tags: ['タスク管理', 'チェックリスト', 'テンプレート', '進捗管理'],
    },
    {
      id: '09',
      name: 'LTV（顧客生涯価値）計算',
      tagline: '顧客ランク別管理・特典自動設定',
      tags: ['LTV計算', '顧客ランク', '特典管理', '売上分析'],
    },
    {
      id: '10',
      name: '離脱顧客掘り起こし',
      tagline: '休眠顧客を自動抽出・復帰キャンペーン',
      tags: ['離脱顧客', 'メール配信', 'クーポン管理', '顧客復帰'],
    },
    {
      id: '11',
      name: '有効期限管理（資格・免許）',
      tagline: '資格・免許の期限を一元管理・自動通知',
      tags: ['資格管理', '免許管理', '期限通知', 'リスク管理'],
    },
    {
      id: '12',
      name: '紹介プログラム完全管理',
      tagline: '紹介キャンペーンの一元管理・効果測定',
      tags: ['紹介管理', 'キャンペーン', '特典管理', '効果測定'],
    },
    {
      id: '13',
      name: '価格テストA/B管理',
      tagline: '価格A/Bテストの計画・実行・分析',
      tags: ['A/Bテスト', '価格最適化', '売上分析', '競合分析'],
    },
    {
      id: '14',
      name: 'キャンペーン効果測定',
      tagline: 'ROAS・ROI・CVを自動計算・可視化',
      tags: ['効果測定', 'ROAS', 'ROI', 'マーケティング'],
    },
    {
      id: '16',
      name: '経費精算ワークフロー',
      tagline: '経費申請・承認・精算の一元管理',
      tags: ['経費精算', 'ワークフロー', '承認管理', '集計レポート'],
    },
    {
      id: '17',
      name: '請求書自動生成＋送付',
      tagline: 'BtoB向け請求書管理・自動送付',
      tags: ['請求書', '自動生成', 'PDF送付', '入金管理'],
    },
    {
      id: '18',
      name: '売上日報自動集計',
      tagline: '日次・週次・月次の売上レポート自動化',
      tags: ['売上集計', '日報管理', 'レポート自動化', 'ダッシュボード'],
    },
    {
      id: '19',
      name: '契約更新リマインド',
      tagline: '契約期限の一元管理・更新通知',
      tags: ['契約管理', '更新通知', 'リマインド', '期限管理'],
    },
    {
      id: '20',
      name: '定例MTGアジェンダ自動収集',
      tagline: '議題収集・アジェンダ配信の自動化',
      tags: ['MTG管理', 'アジェンダ', '議題収集', '自動配信'],
    },
    {
      id: '21',
      name: 'ダブルブッキング防止（予約）',
      tagline: 'Web予約＋重複防止の自動チェック',
      tags: ['予約管理', 'ダブルブッキング防止', '空き状況確認', 'キャンセル待ち'],
    },
    {
      id: '22',
      name: '価格表・見積基準管理',
      tagline: '価格マスタ＋見積作成＋値引きルール',
      tags: ['価格管理', '見積作成', '値引きルール', 'PDF出力'],
    },
    {
      id: '23',
      name: '議事録→タスク自動抽出',
      tagline: '議事録からTODOを自動抽出・リマインド',
      tags: ['議事録管理', 'タスク抽出', 'リマインド', '進捗管理'],
    },
    {
      id: '24',
      name: '勤怠集計→給与計算連携',
      tagline: '勤怠打刻・残業管理・給与計算の自動化',
      tags: ['勤怠管理', '給与計算', '残業管理', '36協定'],
    },
    {
      id: '25',
      name: '承認フロー強制',
      tagline: '申請→承認→実行の流れを可視化・強制',
      tags: ['承認フロー', 'ワークフロー', '監査ログ', 'コンプライアンス'],
    },
    {
      id: '26',
      name: '入金消込チェッカー',
      tagline: '請求と入金の自動マッチング・消込',
      tags: ['入金消込', '請求管理', '自動マッチング', '督促管理'],
    },
    {
      id: '27',
      name: '引継ぎチェックリスト',
      tagline: '引継ぎ項目の漏れ防止・進捗管理',
      tags: ['引継ぎ', 'チェックリスト', '進捗管理', '業務移行'],
    },
    {
      id: '28',
      name: '定型連絡の自動送信',
      tagline: 'メール・LINE定型メッセージの自動配信',
      tags: ['自動送信', 'テンプレート', 'メール', 'LINE', 'スケジュール'],
    },
    {
      id: '29',
      name: '解約理由分析',
      tagline: '解約理由の集計・トレンド分析ダッシュボード',
      tags: ['解約分析', 'ダッシュボード', 'トレンド', '顧客管理'],
    },
    {
      id: '30',
      name: 'シフト希望収集→自動調整',
      tagline: 'スタッフのシフト希望をWeb収集・自動調整',
      tags: ['シフト管理', '希望収集', '自動調整', 'スタッフ管理'],
    },
    {
      id: '31',
      name: '在庫回転率管理',
      tagline: '商品別在庫回転率の自動計算・分析',
      tags: ['在庫管理', '回転率', 'ABC分析', 'コスト削減'],
    },
    {
      id: '32',
      name: '時間帯別売上分析',
      tagline: '時間帯・曜日別の売上データ自動集計',
      tags: ['売上分析', '時間帯分析', 'ヒートマップ', 'シフト最適化'],
    },
    {
      id: '33',
      name: '業務マニュアル管理',
      tagline: '業務マニュアルの作成・管理・共有を一元化',
      tags: ['マニュアル管理', 'ナレッジ共有', 'バージョン管理', '新人教育'],
    },
    {
      id: '34',
      name: 'オンボーディング進捗管理',
      tagline: '新入社員の受入れ進捗を可視化・管理',
      tags: ['オンボーディング', '進捗管理', '新入社員', '人事管理'],
    },
    {
      id: '35',
      name: '試用期間管理',
      tagline: '試用期間の評価・面談スケジュール管理',
      tags: ['試用期間', '評価管理', '面談管理', '人事管理'],
    },
    {
      id: '36',
      name: '季節変動予測',
      tagline: '過去データから季節トレンドを分析・予測',
      tags: ['季節変動', '需要予測', 'トレンド分析', '仕入れ最適化'],
    },
    {
      id: '37',
      name: '顧問契約管理',
      tagline: '顧問契約の期間・報酬・更新を一元管理',
      tags: ['顧問契約', '契約管理', '更新リマインド', '報酬管理'],
    },
    {
      id: '38',
      name: '書類テンプレート管理',
      tagline: '業務書類テンプレートの一元管理・共有',
      tags: ['テンプレート', '書類管理', 'バージョン管理', '社内共有'],
    },
    {
      id: '39',
      name: '案件別工数管理',
      tagline: '案件ごとの工数記録・集計を自動化',
      tags: ['工数管理', 'プロジェクト管理', 'コスト分析', '収益管理'],
    },
    {
      id: '40',
      name: '材料・消耗品管理',
      tagline: '材料・消耗品の在庫管理・発注管理を自動化',
      tags: ['材料管理', '消耗品管理', '在庫管理', '発注管理'],
    },
  ]

  return systems
}
