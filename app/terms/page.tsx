'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function TermsContent() {
  const [agreed, setAgreed] = useState(false)
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') || 'premium'
  const userId = searchParams.get('user_id') || ''

  // Stripe決済URLを構築
  const getPaymentUrl = () => {
    const encodedUserId = Buffer.from(userId).toString('base64')
    if (plan === 'professional') {
      return `${process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PAYMENT_LINK || 'https://buy.stripe.com/fZu6oH78Ea5HcYS1dV6oo0a'}?client_reference_id=${encodedUserId}`
    }
    return `${process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/xxxxx'}?client_reference_id=${encodedUserId}`
  }

  const planDetails = {
    premium: { name: 'プレミアムプラン', price: '月額 10,000円', icon: '💎' },
    professional: { name: 'プロフェッショナルプラン', price: '月額 50,000円', icon: '🎆' }
  }

  const currentPlan = planDetails[plan as keyof typeof planDetails] || planDetails.premium

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">⚡</div>
              <h1 className="text-xl font-bold text-gray-900">GAS Generator</h1>
            </div>
            <div className="text-sm text-gray-600">
              {currentPlan.icon} {currentPlan.name}
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* プログレスインジケーター */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
              <span className="ml-2 text-sm font-medium text-gray-900">プラン選択</span>
            </div>
            <div className="w-16 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
              <span className="ml-2 text-sm font-medium text-gray-900">利用規約</span>
            </div>
            <div className="w-16 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-300 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
              <span className="ml-2 text-sm text-gray-500">決済</span>
            </div>
          </div>
        </div>

        {/* 利用規約カード */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* カードヘッダー */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4">
            <h2 className="text-2xl font-bold">利用規約</h2>
            <p className="text-blue-100 mt-1">最終更新日: 2025年1月17日</p>
          </div>

          {/* 規約内容 */}
          <div className="px-6 py-6 max-h-[500px] overflow-y-auto">
            <div className="prose prose-sm max-w-none text-gray-700">
              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">第1条（利用規約の適用）</h3>
                <p className="leading-relaxed">
                  本利用規約（以下「本規約」）は、株式会社IKEMEN（以下「当社」）が提供するGAS Generator（以下「本サービス」）の利用条件を定めるものです。
                  利用者は、本規約に同意の上、本サービスを利用するものとします。
                </p>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">第2条（サービス内容）</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Google Apps Script（GAS）コードの自動生成</li>
                  <li>生成コードの修正・カスタマイズサポート</li>
                  <li>エラー解決支援</li>
                  <li>画像解析によるコード生成</li>
                  <li>エンジニアサポート（プラン別）</li>
                </ul>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">第3条（料金および支払い）</h3>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                  <p className="font-semibold mb-2">料金体系：</p>
                  <ul className="space-y-2">
                    <li>🆓 <strong>無料プラン</strong>: 月10回まで（0円）</li>
                    <li>💎 <strong>プレミアムプラン</strong>: 無制限利用（月額10,000円・税込）</li>
                    <li>🎆 <strong>プロフェッショナルプラン</strong>: 無制限利用＋優先サポート（月額50,000円・税込）</li>
                  </ul>
                </div>
                <ul className="list-disc pl-5 space-y-2">
                  <li>料金は前払い制とし、毎月自動更新されます</li>
                  <li>決済はStripeを通じて安全に処理されます</li>
                  <li>日割り計算は行いません</li>
                </ul>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">第4条（禁止事項）</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>本サービスを利用した違法行為</li>
                  <li>サーバーへの不正アクセスや過度な負荷をかける行為</li>
                  <li>生成コードを悪用した第三者への損害を与える行為</li>
                  <li>本サービスのリバースエンジニアリング</li>
                  <li>複数アカウントの不正作成</li>
                  <li>他者へのアカウント貸与・転売</li>
                </ul>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">第5条（知的財産権）</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>生成されたコードの著作権は利用者に帰属します</li>
                  <li>本サービス自体の著作権・商標権等は当社に帰属します</li>
                  <li>利用者は生成コードを自由に改変・商用利用できます</li>
                </ul>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">第6条（免責事項）</h3>
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4">
                  <p className="text-sm">
                    <strong>重要:</strong> 当社は生成コードの完全性、正確性、有用性を保証しません。
                    生成コードの利用により生じた損害について、当社は一切の責任を負いません。
                  </p>
                </div>
                <ul className="list-disc pl-5 space-y-2">
                  <li>システムメンテナンスによるサービス停止</li>
                  <li>天災・不可抗力によるサービス中断</li>
                  <li>生成コードのバグや不具合</li>
                  <li>第三者サービス（Google等）の仕様変更による影響</li>
                </ul>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">第7条（返金ポリシー）</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>クーリングオフ:</strong> 初回申込から7日間は全額返金可能</li>
                  <li><strong>サービス不具合:</strong> 当社起因の重大な不具合の場合、日割り返金</li>
                  <li><strong>返金申請:</strong> support@ikemen.co.jp まで連絡</li>
                  <li><strong>処理期間:</strong> 申請から5営業日以内に処理</li>
                </ul>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">第8条（個人情報の取扱い）</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>個人情報は当社プライバシーポリシーに従い適切に管理します</li>
                  <li>LINE IDは本人確認とサービス提供のみに使用します</li>
                  <li>決済情報はStripeが安全に管理し、当社では保持しません</li>
                  <li>第三者への情報提供は法令に基づく場合を除き行いません</li>
                </ul>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">第9条（サービスの変更・終了）</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>当社は30日前の通知により、サービス内容を変更できます</li>
                  <li>サービス終了の場合、60日前に通知します</li>
                  <li>終了時は残存期間分を日割り返金します</li>
                </ul>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">第10条（準拠法・管轄）</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>本規約は日本法に準拠します</li>
                  <li>紛争が生じた場合、東京地方裁判所を専属的合意管轄とします</li>
                </ul>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">第11条（お問い合わせ）</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="mb-2"><strong>運営会社:</strong> 株式会社IKEMEN</p>
                  <p className="mb-2"><strong>メール:</strong> support@ikemen.co.jp</p>
                  <p className="mb-2"><strong>LINE:</strong> @gas-generator</p>
                  <p><strong>営業時間:</strong> 平日 10:00-19:00（土日祝休み）</p>
                </div>
              </section>
            </div>
          </div>

          {/* 同意エリア */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="mb-4">
              <label className="flex items-start cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-3 text-gray-700">
                  上記の利用規約および
                  <Link href="/privacy" className="text-blue-600 hover:underline mx-1">
                    プライバシーポリシー
                  </Link>
                  に同意します
                </span>
              </label>
            </div>

            {/* アクションボタン */}
            <div className="flex space-x-4">
              <button
                onClick={() => window.history.back()}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                戻る
              </button>
              <a
                href={agreed ? getPaymentUrl() : '#'}
                onClick={(e) => {
                  if (!agreed) {
                    e.preventDefault()
                    alert('利用規約に同意してください')
                  }
                }}
                className={`flex-1 px-6 py-3 rounded-lg font-medium text-center transition-all ${
                  agreed
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {currentPlan.price}で決済に進む →
              </a>
            </div>
          </div>
        </div>

        {/* 補足情報 */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p className="mb-2">
            🔒 決済はStripeで安全に処理されます
          </p>
          <p>
            決済後、LINE公式アカウントに自動的にプランが反映されます
          </p>
        </div>
      </main>
    </div>
  )
}

export default function TermsOfService() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl">⚡</div>
          <p className="mt-2 text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <TermsContent />
    </Suspense>
  )
}