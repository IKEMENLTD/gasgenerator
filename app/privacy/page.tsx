'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Header from '@/components/lp/Header'
import Footer from '@/components/lp/Footer'
import '@/app/styles/lp.css'

function PrivacyPolicyContent() {
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') || ''
  const userId = searchParams.get('user_id') || ''

  // 戻るURLを動的に生成
  const backUrl = plan ? `/terms?plan=${plan}&user_id=${userId}` : '/terms'

  return (
    <div className="lp-wrapper">
      <Header />

      <div className="main-content">
        <section className="section-compact section-layer section-layer-white" style={{ paddingTop: '140px', minHeight: '100vh' }}>
          <div className="marker tl">LEGAL // PRIVACY</div>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
              <div className="jp-sub">PRIVACY POLICY</div>
              <Link href={backUrl} className="text-sm border border-gray-300 rounded px-4 py-2 hover:bg-gray-50 transition-colors text-gray-600">
                利用規約に戻る
              </Link>
            </div>

            <h2 className="section-header" style={{ display: 'block', marginBottom: '50px' }}>
              プライバシーポリシー
            </h2>

            <div className="bg-white rounded-2xl p-6 md:p-12 shadow-sm border border-gray-100">
              <p className="mb-8 text-xs text-gray-400 text-right">最終更新日: 2025年1月17日</p>

              <section className="mb-10">
                <p className="text-gray-600 leading-relaxed">
                  株式会社イケメン（以下「当社」）は、Task mate（以下「本サービス」）における
                  個人情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。
                </p>
              </section>

              <section className="mb-10">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">1. 収集する情報</h3>
                <div className="bg-gray-50 border-l-4 border-gray-400 p-4 rounded mb-4">
                  <p className="font-bold text-gray-700 mb-2">当社が収集する情報：</p>
                  <ul className="list-disc pl-5 text-gray-600 space-y-1">
                    <li>LINE ユーザーID（識別用）</li>
                    <li>LINE 表示名（コミュニケーション用）</li>
                    <li>利用履歴（サービス改善用）</li>
                    <li>生成したコード内容（サポート用）</li>
                    <li>エラーログ（品質改善用）</li>
                  </ul>
                </div>
                <p className="text-xs text-gray-400">※ クレジットカード情報はStripe社が管理し、当社では保持しません</p>
              </section>

              <section className="mb-10">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">2. 情報の利用目的</h3>
                <ul className="space-y-2 text-gray-600">
                  <li><strong>サービス提供:</strong> コード生成、カスタマイズ、エラー解決支援</li>
                  <li><strong>ユーザーサポート:</strong> お問い合わせ対応、技術支援</li>
                  <li><strong>サービス改善:</strong> 機能改善、新機能開発、UI/UX向上</li>
                  <li><strong>セキュリティ:</strong> 不正利用防止、システム保護</li>
                  <li><strong>通知:</strong> 重要なお知らせ、メンテナンス情報</li>
                </ul>
              </section>

              <section className="mb-10">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">3. 第三者提供</h3>
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                  <p className="font-bold text-gray-700 mb-2">原則として第三者提供は行いません</p>
                  <p className="text-sm text-gray-600 mb-2">以下の場合を除く：</p>
                  <ul className="list-disc pl-5 text-gray-600 space-y-1 text-sm">
                    <li>法令に基づく開示要請</li>
                    <li>人命・身体・財産の保護に必要な場合</li>
                    <li>利用者の同意がある場合</li>
                  </ul>
                </div>
              </section>

              <section className="mb-10">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">4. 外部サービスの利用</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded border border-gray-100">
                    <h4 className="font-bold text-gray-700 text-sm mb-1">Claude AI (Anthropic)</h4>
                    <p className="text-xs text-gray-500">コード生成処理のみに使用。個人情報は送信しません。</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded border border-gray-100">
                    <h4 className="font-bold text-gray-700 text-sm mb-1">Stripe</h4>
                    <p className="text-xs text-gray-500">決済処理。PCI DSS準拠の安全な決済システム。</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded border border-gray-100">
                    <h4 className="font-bold text-gray-700 text-sm mb-1">Supabase</h4>
                    <p className="text-xs text-gray-500">データベース管理。SOC 2 Type II認証取得済み。</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded border border-gray-100">
                    <h4 className="font-bold text-gray-700 text-sm mb-1">LINE Messaging API</h4>
                    <p className="text-xs text-gray-500">メッセージング機能。LINEプライバシーポリシーに準拠。</p>
                  </div>
                </div>
              </section>

              <section className="mb-10">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">5. データの保管と安全性</h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-600">
                  <li>すべての通信はSSL/TLSで暗号化</li>
                  <li>データベースは暗号化して保管</li>
                  <li>アクセス権限は最小限に制限</li>
                  <li>定期的なセキュリティ監査を実施</li>
                  <li>24時間365日の監視体制</li>
                </ul>
              </section>

              <section className="mb-10">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">6. データの保存期間</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-3 text-sm font-bold text-gray-700">データ種別</th>
                        <th className="p-3 text-sm font-bold text-gray-700">保存期間</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="p-3 text-sm text-gray-600">アカウント情報</td>
                        <td className="p-3 text-sm text-gray-600">退会後1年間</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="p-3 text-sm text-gray-600">生成コード</td>
                        <td className="p-3 text-sm text-gray-600">生成後6ヶ月</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="p-3 text-sm text-gray-600">会話履歴</td>
                        <td className="p-3 text-sm text-gray-600">3ヶ月</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="p-3 text-sm text-gray-600">エラーログ</td>
                        <td className="p-3 text-sm text-gray-600">30日</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="mb-10">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">7. お客様の権利</h3>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                  <p className="font-bold text-gray-700 mb-2">以下の権利を行使できます：</p>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex gap-2"><span className="font-bold text-blue-600">1</span> <span><strong>開示請求:</strong> 保有個人情報の開示</span></li>
                    <li className="flex gap-2"><span className="font-bold text-blue-600">2</span> <span><strong>訂正請求:</strong> 誤った情報の訂正</span></li>
                    <li className="flex gap-2"><span className="font-bold text-blue-600">3</span> <span><strong>削除請求:</strong> 不要な情報の削除</span></li>
                    <li className="flex gap-2"><span className="font-bold text-blue-600">4</span> <span><strong>利用停止:</strong> 個人情報利用の停止</span></li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-4">請求方法: info@ikemen.ltd まで本人確認書類を添えてご連絡ください</p>
                </div>
              </section>

              <section className="mb-10">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">8. Cookie（クッキー）の使用</h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-600">
                  <li>セッション管理のための必要最小限のCookieを使用</li>
                  <li>Google Analyticsによるアクセス解析（匿名化済み）</li>
                  <li>広告配信は行いません</li>
                  <li>ブラウザ設定でCookie を無効化可能</li>
                </ul>
              </section>

              <section className="mb-10">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">9. 児童のプライバシー</h3>
                <p className="text-gray-600 leading-relaxed">
                  本サービスは13歳未満の児童を対象としていません。
                  13歳未満の方は保護者の同意を得てご利用ください。
                </p>
              </section>

              <section className="mb-10">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">10. プライバシーポリシーの変更</h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-600">
                  <li>変更時はLINE公式アカウントで通知</li>
                  <li>重要な変更は30日前に事前通知</li>
                  <li>最新版は常に本ページで確認可能</li>
                </ul>
              </section>

              <section className="mb-10">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">11. お問い合わせ窓口</h3>
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <p className="font-bold text-gray-800 mb-2">個人情報管理責任者</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>株式会社イケメン プライバシー保護担当</p>
                    <p>メール: info@ikemen.ltd</p>
                    <p>LINE: @356uysad</p>
                    <p>住所: 東京都品川区大崎4丁目4-24</p>
                    <p>対応時間: 平日 10:00-19:00</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">12. 準拠法と管轄</h3>
                <p className="text-gray-600 leading-relaxed">
                  本ポリシーは日本法に準拠し、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
                </p>
              </section>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  )
}

export default function PrivacyPolicy() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PrivacyPolicyContent />
    </Suspense>
  )
}