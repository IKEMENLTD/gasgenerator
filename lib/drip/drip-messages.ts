/**
 * ドリップキャンペーン メッセージテンプレート
 *
 * 7日間の面談CTA付きステップ配信
 * 各日のメッセージは異なる心理的アプローチで設計:
 *
 * Day 1: 具体例で価値を見せる（理解促進）
 * Day 2: 時間的インパクト（数字で説得）
 * Day 3: 導入事例（社会的証明）
 * Day 4: あるある課題（共感・自分事化）
 * Day 5: 面談の中身を説明（不安解消）
 * Day 6: 機会損失の可視化（論理的説得）
 * Day 7: 最終ご案内（ラストチャンス）
 */

interface DripMessage {
  type: 'text' | 'template' | 'flex'
  content: any
}

const CONSULTATION_LABEL = '📅 無料相談を予約する'
const CONSULTATION_TEXT = '無料相談を予約'
const CATALOG_LABEL = '📦 システム一覧を見る'
const CATALOG_TEXT = 'システム一覧'
const TRY_LABEL = '🔍 業務の自動化を診断する'
const TRY_TEXT = 'AI診断'

function getConsultationAction(): any {
  const bookingUrl = process.env.CONSULTATION_BOOKING_URL
  if (bookingUrl) {
    return { type: 'uri', label: CONSULTATION_LABEL, uri: bookingUrl }
  }
  return { type: 'message', label: CONSULTATION_LABEL, text: CONSULTATION_TEXT }
}

function createQuickReplyItems(items: Array<{ label: string; text?: string; uri?: string }>): any {
  return items.map(item => {
    if (item.uri) {
      return { type: 'action', action: { type: 'uri', label: item.label, uri: item.uri } }
    }
    return { type: 'action', action: { type: 'message', label: item.label, text: item.text } }
  })
}

/**
 * Day 1: 具体例で価値を見せる
 *
 * ターゲット心理: 「GASコード自動生成って言われても何ができるの？」
 * アプローチ: 日常業務の言葉で具体例を3つ見せる
 * CTA強度: ★☆☆☆☆（ソフト）
 */
export function getDripMessageDay1(): DripMessage[] {
  const consultAction = getConsultationAction()
  return [
    {
      type: 'text',
      content: {
        type: 'text',
        text: [
          '💡 Task mate 活用のヒント',
          '',
          '追加ありがとうございます！',
          '実はこんな「面倒な作業」をワンタッチで自動化できます：',
          '',
          '📊 毎朝の売上をスプレッドシートに自動集計',
          '📧 請求書を毎月自動でメール送信',
          '📅 会議の前日に参加者へ自動リマインド',
          '',
          '「うちの業務でも使える？」と思った方は',
          'お気軽にご相談ください👇',
        ].join('\n'),
        quickReply: {
          items: [
            { type: 'action', action: consultAction },
            ...createQuickReplyItems([
              { label: TRY_LABEL, text: TRY_TEXT },
              { label: CATALOG_LABEL, text: CATALOG_TEXT },
            ]),
          ]
        }
      }
    }
  ]
}

/**
 * Day 2: 時間的インパクトを数字で見せる
 *
 * ターゲット心理: 「便利そうだけど、そこまで変わる？」
 * アプローチ: 具体的な時間を数字で示してインパクトを与える
 * CTA強度: ★★☆☆☆（やや強め）
 */
export function getDripMessageDay2(): DripMessage[] {
  const consultAction = getConsultationAction()
  // Day2用: ラベルを「試算する」に差し替え
  const day2ConsultAction = consultAction.type === 'uri'
    ? { ...consultAction, label: '📅 無料相談で試算する' }
    : { ...consultAction, label: '📅 無料相談で試算する' }
  return [
    {
      type: 'text',
      content: {
        type: 'text',
        text: [
          '⏰ 月に何時間、同じ作業を繰り返していますか？',
          '',
          'Task mate ユーザーの平均的な効果：',
          '',
          '  手作業  →  自動化',
          '  月20時間 →  月0時間',
          '',
          '浮いた時間を本業に使えたら、',
          '売上にどれだけ影響があるでしょうか？',
          '',
          '具体的な削減時間を一緒に計算してみませんか？👇',
        ].join('\n'),
        quickReply: {
          items: [
            { type: 'action', action: day2ConsultAction },
            ...createQuickReplyItems([
              { label: TRY_LABEL, text: TRY_TEXT },
            ]),
          ]
        }
      }
    }
  ]
}

/**
 * Day 3: 導入事例で社会的証明
 *
 * ターゲット心理: 「本当に使ってる人いるの？」
 * アプローチ: Before/Afterの具体事例で信頼構築
 * CTA強度: ★★☆☆☆
 */
export function getDripMessageDay3(): DripMessage[] {
  const consultAction = getConsultationAction()
  return [
    {
      type: 'text',
      content: {
        type: 'text',
        text: [
          '📋 導入事例のご紹介',
          '',
          '▼ 不動産管理会社さまの例',
          '',
          '【Before】',
          '・契約更新のリマインドを手動で管理',
          '・更新漏れが月に2〜3件発生',
          '・クレーム対応に追われる日々',
          '',
          '【After】',
          '・更新日の30日前に自動アラート',
          '・更新漏れゼロを達成',
          '・導入はわずか1日で完了',
          '',
          '「自社ならどう使える？」を',
          '15分の面談でご提案します👇',
        ].join('\n'),
        quickReply: {
          items: [
            { type: 'action', action: consultAction },
            ...createQuickReplyItems([
              { label: TRY_LABEL, text: TRY_TEXT },
              { label: CATALOG_LABEL, text: CATALOG_TEXT },
            ]),
          ]
        }
      }
    }
  ]
}

/**
 * Day 4: あるある課題で共感を引く
 *
 * ターゲット心理: 「忙しいし、後でいいか」
 * アプローチ: 日常の不満を言語化して「あ、まさにそれ」と思わせる
 * CTA強度: ★★★☆☆（中程度）
 */
export function getDripMessageDay4(): DripMessage[] {
  const consultAction = getConsultationAction()
  return [
    {
      type: 'text',
      content: {
        type: 'text',
        text: [
          'こんな「あるある」ありませんか？',
          '',
          '☑ 月末の集計作業が毎回憂鬱',
          '☑ 「あの件、進捗どう？」の確認が多い',
          '☑ 同じメールを少しずつ変えて何十通も送る',
          '☑ 期限管理がExcelで限界を感じている',
          '',
          '1つでも当てはまれば、',
          '自動化で大幅に改善できる可能性があります💡',
          '',
          '具体的な改善案をお伝えします👇',
        ].join('\n'),
        quickReply: {
          items: [
            { type: 'action', action: consultAction },
            ...createQuickReplyItems([
              { label: TRY_LABEL, text: TRY_TEXT },
              { label: '👨‍💻 チャットで質問', text: 'エンジニアに相談する' },
            ]),
          ]
        }
      }
    }
  ]
}

/**
 * Day 5: 面談の中身を説明して不安を消す
 *
 * ターゲット心理: 「面談って何するの？営業されそう…」
 * アプローチ: Q&A形式で面談のハードルを徹底的に下げる
 * CTA強度: ★★★☆☆
 */
export function getDripMessageDay5(): DripMessage[] {
  const consultAction = getConsultationAction()
  return [
    {
      type: 'text',
      content: {
        type: 'text',
        text: [
          '📞 「無料相談」って何をするの？',
          '',
          'よくいただく質問にお答えします：',
          '',
          'Q. 何を話すの？',
          '→ 御社の業務で自動化できそうな箇所を一緒に洗い出します',
          '',
          'Q. 専門知識は必要？',
          '→ 一切不要です。「毎月この作業が面倒で…」だけでOK',
          '',
          'Q. 時間は？',
          '→ 15分程度。オンラインで完結します',
          '',
          'Q. 無理な営業はある？',
          '→ ありません。合わなければそれで大丈夫です',
          '',
          '安心してお気軽にどうぞ👇',
        ].join('\n'),
        quickReply: {
          items: [
            { type: 'action', action: consultAction },
            ...createQuickReplyItems([
              { label: TRY_LABEL, text: TRY_TEXT },
            ]),
          ]
        }
      }
    }
  ]
}

/**
 * Day 6: 機会損失を可視化する
 *
 * ターゲット心理: 「まあいつかやるよ」
 * アプローチ: 数字で機会損失を見せ、先延ばしのコストを意識させる
 * CTA強度: ★★★★☆（強め）
 */
export function getDripMessageDay6(): DripMessage[] {
  const consultAction = getConsultationAction()
  return [
    {
      type: 'text',
      content: {
        type: 'text',
        text: [
          '📊 ある試算をしてみました',
          '',
          'もし毎日30分の手作業を自動化したら…',
          '',
          '▼ 1ヶ月で → 約10時間',
          '▼ 半年で  → 約60時間',
          '▼ 1年で   → 約120時間',
          '',
          '120時間 ＝ 約15営業日分の時間。',
          '',
          '「自動化したいけど、何から始めれば…」',
          'その最初の一歩を、面談でお手伝いします👇',
        ].join('\n'),
        quickReply: {
          items: [
            { type: 'action', action: consultAction },
            ...createQuickReplyItems([
              { label: TRY_LABEL, text: TRY_TEXT },
            ]),
          ]
        }
      }
    }
  ]
}

/**
 * Day 7: 最終ご案内（ラストチャンス）
 *
 * ターゲット心理: 「また来たか…でもまあいいか」
 * アプローチ: 「最後」と明示し、安心感と緊急性を両立
 * CTA強度: ★★★★★（最強）
 */
export function getDripMessageDay7(): DripMessage[] {
  const consultAction = getConsultationAction()
  return [
    {
      type: 'text',
      content: {
        type: 'text',
        text: [
          '📢 最後のご案内です',
          '',
          'Task mate を追加いただき、',
          '1週間ありがとうございました。',
          '',
          '定期的なご案内はこちらで最後となります。',
          '',
          'もし少しでも業務の自動化に',
          '興味がおありでしたら、一度お話しさせてください。',
          '',
          '✅ 15分の無料面談',
          '✅ オンラインで完結',
          '✅ 御社に合った自動化をご提案',
          '✅ 無理な勧誘は一切なし',
          '',
          'いつでもお待ちしています👇',
        ].join('\n'),
        quickReply: {
          items: [
            { type: 'action', action: consultAction },
            ...createQuickReplyItems([
              { label: TRY_LABEL, text: TRY_TEXT },
              { label: CATALOG_LABEL, text: CATALOG_TEXT },
              { label: '📋 メニュー', text: 'メニュー' },
            ]),
          ]
        }
      }
    }
  ]
}

/**
 * ステップ番号に対応するメッセージを取得
 */
export function getDripMessage(step: number): DripMessage[] | null {
  switch (step) {
    case 1: return getDripMessageDay1()
    case 2: return getDripMessageDay2()
    case 3: return getDripMessageDay3()
    case 4: return getDripMessageDay4()
    case 5: return getDripMessageDay5()
    case 6: return getDripMessageDay6()
    case 7: return getDripMessageDay7()
    default: return null
  }
}

export const DRIP_TOTAL_STEPS = 7
