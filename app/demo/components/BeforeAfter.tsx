'use client'

import { useState } from 'react'

interface Scenario {
  before: {
    title: string
    steps: string[]
    time: string
    errors: string
  }
  after: {
    title: string
    steps: string[]
    time: string
    errors: string
  }
}

interface BeforeAfterProps {
  scenarioId: 'salesAggregation' | 'inventoryAlert' | 'weeklyReport'
}

export default function BeforeAfter({ scenarioId }: BeforeAfterProps) {
  const [activeTab, setActiveTab] = useState<'before' | 'after'>('before')

  const scenarios: Record<string, Scenario> = {
    salesAggregation: {
      before: {
        title: '手動作業の場合',
        steps: [
          'Googleフォームから回答をダウンロード',
          'Excelで開いて整形',
          'VLOOKUP関数で商品情報を紐付け',
          'ピボットテーブルで集計',
          'グラフを作成',
          'レポートをメールで送信'
        ],
        time: '毎日60分',
        errors: '入力ミス・計算ミスが頻発'
      },
      after: {
        title: 'TaskMate導入後',
        steps: [
          'LINEで「売上を自動集計したい」と送信',
          'TaskMateがGASコードを生成',
          'コピペして完了',
          '以降は完全自動で集計・通知'
        ],
        time: '初回5分のみ（以降0分）',
        errors: 'ミスゼロ・完全自動化'
      }
    },
    inventoryAlert: {
      before: {
        title: '手動作業の場合',
        steps: [
          '毎日スプレッドシートを開く',
          '在庫数を目視でチェック',
          '閾値を下回る商品を探す',
          'Slackに手動で通知を投稿',
          '発注依頼をメールで送信'
        ],
        time: '毎日30分',
        errors: '見落としリスク・通知漏れ'
      },
      after: {
        title: 'TaskMate導入後',
        steps: [
          'LINEで「在庫アラートが欲しい」と送信',
          'TaskMateがGASコードを生成',
          'コピペして完了',
          '毎朝自動でチェック・通知'
        ],
        time: '初回5分のみ（以降0分）',
        errors: 'ミスゼロ・見落としなし'
      }
    },
    weeklyReport: {
      before: {
        title: '手動作業の場合',
        steps: [
          '毎週金曜に各シートからデータ収集',
          'Wordでレポート作成',
          'グラフをコピペして整形',
          'PDFに変換',
          'メールに添付して送信',
          '送信先を確認（CCミスに注意）'
        ],
        time: '毎週90分',
        errors: '送信ミス・データミス'
      },
      after: {
        title: 'TaskMate導入後',
        steps: [
          'LINEで「週次レポートを自動化したい」と送信',
          'TaskMateがGASコードを生成',
          'コピペして完了',
          '毎週金曜18時に自動送信'
        ],
        time: '初回5分のみ（以降0分）',
        errors: 'ミスゼロ・送信漏れなし'
      }
    }
  }

  const scenario = scenarios[scenarioId]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
      <h3 className="font-bold text-lg mb-4 text-gray-900 text-center">
        作業時間の比較
      </h3>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('before')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            activeTab === 'before'
              ? 'bg-red-100 text-red-700 border-2 border-red-500'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
          }`}
        >
          ❌ Before
        </button>
        <button
          onClick={() => setActiveTab('after')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
            activeTab === 'after'
              ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-500'
              : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
          }`}
        >
          ✓ After
        </button>
      </div>

      {/* Before Content */}
      {activeTab === 'before' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <h4 className="font-bold text-red-900 mb-3">{scenario.before.title}</h4>
            <ol className="space-y-2 mb-4">
              {scenario.before.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-red-800">
                  <span className="font-bold min-w-[20px]">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-red-200">
              <div>
                <div className="text-xs text-red-600 mb-1">⏱️ 所要時間</div>
                <div className="font-bold text-red-900">{scenario.before.time}</div>
              </div>
              <div>
                <div className="text-xs text-red-600 mb-1">⚠️ エラーリスク</div>
                <div className="font-bold text-red-900">{scenario.before.errors}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* After Content */}
      {activeTab === 'after' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded">
            <h4 className="font-bold text-emerald-900 mb-3">{scenario.after.title}</h4>
            <ol className="space-y-2 mb-4">
              {scenario.after.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-emerald-800">
                  <span className="font-bold min-w-[20px]">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-emerald-200">
              <div>
                <div className="text-xs text-emerald-600 mb-1">⏱️ 所要時間</div>
                <div className="font-bold text-emerald-900">{scenario.after.time}</div>
              </div>
              <div>
                <div className="text-xs text-emerald-600 mb-1">✓ エラーリスク</div>
                <div className="font-bold text-emerald-900">{scenario.after.errors}</div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg p-4 text-white text-center">
            <p className="font-bold mb-1">あなたも同じ効果を実感できます</p>
            <p className="text-sm text-emerald-100">まずは無料相談で詳しく聞いてみませんか？</p>
          </div>
        </div>
      )}
    </div>
  )
}
