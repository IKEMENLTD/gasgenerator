'use client'

import React from 'react'
import Header from '@/components/lp/Header'
import Footer from '@/components/lp/Footer'
import '@/app/styles/lp.css'

export default function LegalPage() {
  return (
    <div className="lp-wrapper">
      <Header />

      <div className="main-content">
        <section className="section-compact section-layer section-layer-white" style={{ paddingTop: '140px', minHeight: '100vh' }}>
          <div className="marker tl">LEGAL // ACT</div>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="jp-sub">LEGAL INFORMATION</div>
            <h2 className="section-header" style={{ display: 'block', marginBottom: '50px' }}>
              特定商取引法に基づく表記
            </h2>

            <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-gray-100">
              <table className="w-full text-left border-collapse">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <th className="py-4 font-bold text-gray-700 w-1/3 align-top">販売業者</th>
                    <td className="py-4 text-gray-600">株式会社イケメン</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <th className="py-4 font-bold text-gray-700 align-top">運営統括責任者</th>
                    <td className="py-4 text-gray-600">沼倉 隆平</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <th className="py-4 font-bold text-gray-700 align-top">所在地</th>
                    <td className="py-4 text-gray-600">東京都品川区大崎4丁目4-24</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <th className="py-4 font-bold text-gray-700 align-top">電話番号</th>
                    <td className="py-4 text-gray-600">
                      050-8890-8975<br />
                      <span className="text-xs text-gray-400">※サービスに関するお問い合わせは、原則としてLINE公式アカウントまたはメールにて承っております。</span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <th className="py-4 font-bold text-gray-700 align-top">メールアドレス</th>
                    <td className="py-4 text-gray-600">info@ikemen.ltd</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <th className="py-4 font-bold text-gray-700 align-top">販売価格</th>
                    <td className="py-4 text-gray-600">
                      <div className="mb-2"><strong>プレミアムプラン（1万円プラン）:</strong> 月額10,000円（税込）</div>
                      <div><strong>プロフェッショナルプラン（5万円プラン）:</strong> 月額50,000円（税込）</div>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <th className="py-4 font-bold text-gray-700 align-top">商品代金以外の必要料金</th>
                    <td className="py-4 text-gray-600">インターネット接続料金、通信料金等はお客様のご負担となります。</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <th className="py-4 font-bold text-gray-700 align-top">支払方法</th>
                    <td className="py-4 text-gray-600">クレジットカード決済（Stripe）</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <th className="py-4 font-bold text-gray-700 align-top">支払時期</th>
                    <td className="py-4 text-gray-600">初回申込み時および翌月以降毎月（自動更新）</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <th className="py-4 font-bold text-gray-700 align-top">役務の提供時期</th>
                    <td className="py-4 text-gray-600">決済完了後、直ちにご利用いただけます。</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <th className="py-4 font-bold text-gray-700 align-top">キャンセル・返金について</th>
                    <td className="py-4 text-gray-600">
                      <div className="mb-2"><strong>7日間全額返金保証:</strong> 初回申込から7日間は理由を問わず全額返金いたします。</div>
                      <div className="mb-2"><strong>30日以内返金制度:</strong> 初回申込から30日以内、所定の条件を満たす場合に返金申請が可能です。</div>
                      <div><strong>途中解約:</strong> 最低契約期間（6ヶ月）経過後は、次回更新日の10営業日前までの申請により解約可能です。期間満了前の解約には残存期間分の料金が発生します。</div>
                    </td>
                  </tr>
                  <tr>
                    <th className="py-4 font-bold text-gray-700 align-top">動作環境</th>
                    <td className="py-4 text-gray-600">
                      <div>Google Chrome 最新版</div>
                      <div>Google スプレッドシートが動作する環境</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  )
}
