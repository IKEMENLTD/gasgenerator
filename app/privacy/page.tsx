'use client'

import Link from 'next/link'

export default function PrivacyPolicy() {
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
            <Link href="/terms" className="text-sm text-blue-600 hover:underline">
              利用規約に戻る
            </Link>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* カードヘッダー */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4">
            <h2 className="text-2xl font-bold">プライバシーポリシー</h2>
            <p className="text-indigo-100 mt-1">最終更新日: 2025年1月17日</p>
          </div>

          {/* ポリシー内容 */}
          <div className="px-6 py-6 max-h-[600px] overflow-y-auto">
            <div className="prose prose-sm max-w-none text-gray-700">
              <section className="mb-6">
                <p className="leading-relaxed mb-4">
                  株式会社IKEMEN（以下「当社」）は、GAS Generator（以下「本サービス」）における
                  個人情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。
                </p>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">1. 収集する情報</h3>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                  <p className="font-semibold mb-2">当社が収集する情報：</p>
                  <ul className="space-y-2">
                    <li>✅ LINE ユーザーID（識別用）</li>
                    <li>✅ LINE 表示名（コミュニケーション用）</li>
                    <li>✅ 利用履歴（サービス改善用）</li>
                    <li>✅ 生成したコード内容（サポート用）</li>
                    <li>✅ エラーログ（品質改善用）</li>
                  </ul>
                </div>
                <p className="text-sm text-gray-600">
                  ※ クレジットカード情報はStripe社が管理し、当社では保持しません
                </p>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">2. 情報の利用目的</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>サービス提供:</strong> コード生成、カスタマイズ、エラー解決支援</li>
                  <li><strong>ユーザーサポート:</strong> お問い合わせ対応、技術支援</li>
                  <li><strong>サービス改善:</strong> 機能改善、新機能開発、UI/UX向上</li>
                  <li><strong>セキュリティ:</strong> 不正利用防止、システム保護</li>
                  <li><strong>通知:</strong> 重要なお知らせ、メンテナンス情報</li>
                </ul>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">3. 第三者提供</h3>
                <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
                  <p className="font-semibold">原則として第三者提供は行いません</p>
                  <p className="text-sm mt-2">以下の場合を除く：</p>
                  <ul className="text-sm mt-2 space-y-1">
                    <li>• 法令に基づく開示要請</li>
                    <li>• 人命・身体・財産の保護に必要な場合</li>
                    <li>• 利用者の同意がある場合</li>
                  </ul>
                </div>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">4. 外部サービスの利用</h3>
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2">🤖 Claude AI (Anthropic)</h4>
                    <p className="text-sm">コード生成処理のみに使用。個人情報は送信しません。</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2">💳 Stripe</h4>
                    <p className="text-sm">決済処理。PCI DSS準拠の安全な決済システム。</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2">🗄️ Supabase</h4>
                    <p className="text-sm">データベース管理。SOC 2 Type II認証取得済み。</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2">💬 LINE Messaging API</h4>
                    <p className="text-sm">メッセージング機能。LINEプライバシーポリシーに準拠。</p>
                  </div>
                </div>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">5. データの保管と安全性</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>すべての通信はSSL/TLSで暗号化</li>
                  <li>データベースは暗号化して保管</li>
                  <li>アクセス権限は最小限に制限</li>
                  <li>定期的なセキュリティ監査を実施</li>
                  <li>24時間365日の監視体制</li>
                </ul>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">6. データの保存期間</h3>
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left">データ種別</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">保存期間</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">アカウント情報</td>
                      <td className="border border-gray-300 px-4 py-2">退会後1年間</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">生成コード</td>
                      <td className="border border-gray-300 px-4 py-2">生成後6ヶ月</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">会話履歴</td>
                      <td className="border border-gray-300 px-4 py-2">3ヶ月</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">エラーログ</td>
                      <td className="border border-gray-300 px-4 py-2">30日</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">7. お客様の権利</h3>
                <div className="bg-purple-50 border-l-4 border-purple-500 p-4">
                  <p className="font-semibold mb-2">以下の権利を行使できます：</p>
                  <ul className="space-y-2">
                    <li>📄 <strong>開示請求:</strong> 保有個人情報の開示</li>
                    <li>✏️ <strong>訂正請求:</strong> 誤った情報の訂正</li>
                    <li>🗑️ <strong>削除請求:</strong> 不要な情報の削除</li>
                    <li>⏸️ <strong>利用停止:</strong> 個人情報利用の停止</li>
                  </ul>
                  <p className="text-sm mt-3">
                    請求方法: support@ikemen.co.jp まで本人確認書類を添えてご連絡ください
                  </p>
                </div>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">8. Cookie（クッキー）の使用</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>セッション管理のための必要最小限のCookieを使用</li>
                  <li>Google Analyticsによるアクセス解析（匿名化済み）</li>
                  <li>広告配信は行いません</li>
                  <li>ブラウザ設定でCookie を無効化可能</li>
                </ul>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">9. 児童のプライバシー</h3>
                <p className="mb-2">
                  本サービスは13歳未満の児童を対象としていません。
                  13歳未満の方は保護者の同意を得てご利用ください。
                </p>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">10. プライバシーポリシーの変更</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>変更時はLINE公式アカウントで通知</li>
                  <li>重要な変更は30日前に事前通知</li>
                  <li>最新版は常に本ページで確認可能</li>
                </ul>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">11. お問い合わせ窓口</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-semibold mb-3">個人情報管理責任者</p>
                  <p className="mb-2">株式会社IKEMEN プライバシー保護担当</p>
                  <p className="mb-2">📧 privacy@ikemen.co.jp</p>
                  <p className="mb-2">📱 LINE: @gas-generator</p>
                  <p className="mb-2">📍 東京都渋谷区〇〇 1-2-3</p>
                  <p>⏰ 対応時間: 平日 10:00-19:00</p>
                </div>
              </section>

              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">12. 準拠法と管轄</h3>
                <p>
                  本ポリシーは日本法に準拠し、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
                </p>
              </section>
            </div>
          </div>

          {/* フッター */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                © 2025 IKEMEN Ltd. All rights reserved.
              </p>
              <Link href="/terms" className="text-blue-600 hover:underline text-sm">
                利用規約に戻る
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}