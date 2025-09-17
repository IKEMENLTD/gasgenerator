'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function TermsContent() {
  const [agreed, setAgreed] = useState(false)
  const searchParams = useSearchParams()
  const plan = searchParams.get('plan') || 'premium'
  const userId = searchParams.get('user_id') || ''

  // Stripe決済URLを構築（正しいURLを使用）
  const getPaymentUrl = () => {
    const encodedUserId = Buffer.from(userId).toString('base64')
    if (plan === 'professional') {
      return `${process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_PAYMENT_LINK || 'https://buy.stripe.com/fZu6oH78Ea5HcYS1dV6oo0a'}?client_reference_id=${encodedUserId}`
    }
    return `${process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/7sY3cv2So0v78ICbSz6oo09'}?client_reference_id=${encodedUserId}`
  }

  const planDetails = {
    premium: { name: 'プレミアムプラン', price: '月額 10,000円' },
    professional: { name: 'プロフェッショナルプラン', price: '月額 50,000円' }
  }

  const currentPlan = planDetails[plan as keyof typeof planDetails] || planDetails.premium

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .page-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
          position: relative;
          overflow: hidden;
        }

        .page-container::before {
          content: '';
          position: absolute;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 50px 50px;
          animation: bgMove 60s linear infinite;
        }

        @keyframes bgMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }

        .header {
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(20px);
          box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
          position: relative;
          z-index: 10;
        }

        .header-content {
          max-width: 1440px;
          margin: 0 auto;
          padding: clamp(1rem, 3vw, 1.5rem) clamp(1rem, 4vw, 2rem);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: clamp(0.5rem, 2vw, 0.75rem);
          font-size: clamp(1.125rem, 3vw, 1.5rem);
          font-weight: 700;
          color: #1f2937;
          text-decoration: none;
          transition: transform 0.2s;
        }

        .logo:hover {
          transform: translateY(-2px);
        }

        .plan-badge {
          background: linear-gradient(135deg, #6b7280, #4b5563);
          color: white;
          padding: clamp(0.375rem, 2vw, 0.5rem) clamp(0.875rem, 3vw, 1.25rem);
          border-radius: 50px;
          font-size: clamp(0.75rem, 2vw, 0.875rem);
          font-weight: 600;
          box-shadow: 0 4px 15px rgba(107, 114, 128, 0.3);
        }

        .main-content {
          max-width: 1200px;
          margin: clamp(1.5rem, 5vw, 3rem) auto;
          padding: 0 clamp(1rem, 3vw, 1.5rem);
          position: relative;
          z-index: 5;
        }

        .progress-bar {
          background: rgba(255, 255, 255, 0.95);
          border-radius: clamp(12px, 3vw, 20px);
          padding: clamp(1.25rem, 3vw, 2rem);
          margin-bottom: clamp(1.25rem, 3vw, 2rem);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
        }

        .progress-steps {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .progress-step {
          display: flex;
          align-items: center;
          flex: 1;
        }

        .step-circle {
          width: clamp(32px, 5vw, 40px);
          height: clamp(32px, 5vw, 40px);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: clamp(0.875rem, 2vw, 1rem);
          transition: all 0.3s;
        }

        .step-circle.active {
          background: linear-gradient(135deg, #6b7280, #4b5563);
          color: white;
          box-shadow: 0 4px 15px rgba(107, 114, 128, 0.3);
        }

        .step-circle.completed {
          background: #10b981;
          color: white;
        }

        .step-circle.pending {
          background: #e5e7eb;
          color: #9ca3af;
        }

        .step-label {
          margin-left: clamp(0.5rem, 2vw, 0.75rem);
          font-size: clamp(0.75rem, 2vw, 0.9rem);
          font-weight: 600;
          color: #374151;
        }

        .step-connector {
          flex: 1;
          height: 2px;
          background: #e5e7eb;
          margin: 0 clamp(0.5rem, 2vw, 1rem);
        }

        .terms-card {
          background: white;
          border-radius: clamp(12px, 3vw, 24px);
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        }

        .card-header {
          background: linear-gradient(135deg, #4b5563, #6b7280);
          padding: clamp(1.5rem, 4vw, 2.5rem);
          color: white;
        }

        .card-title {
          font-size: clamp(1.5rem, 4vw, 2.25rem);
          font-weight: 700;
          margin-bottom: clamp(0.25rem, 1vw, 0.5rem);
        }

        .card-subtitle {
          font-size: clamp(0.875rem, 2vw, 1rem);
          opacity: 0.9;
        }

        .terms-content {
          padding: clamp(1.5rem, 4vw, 3rem);
          max-height: 70vh;
          overflow-y: auto;
        }

        .terms-content::-webkit-scrollbar {
          width: 8px;
        }

        .terms-content::-webkit-scrollbar-track {
          background: #f9fafb;
          border-radius: 10px;
        }

        .terms-content::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #4b5563, #6b7280);
          border-radius: 10px;
        }

        .section {
          margin-bottom: clamp(1.5rem, 4vw, 2.5rem);
        }

        .section-title {
          font-size: clamp(1rem, 2.5vw, 1.25rem);
          font-weight: 700;
          color: #1f2937;
          margin-bottom: clamp(0.75rem, 2vw, 1rem);
          padding-bottom: clamp(0.375rem, 1vw, 0.5rem);
          border-bottom: 2px solid #e5e7eb;
        }

        .section-content {
          color: #4b5563;
          line-height: 1.8;
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .list-item {
          margin-bottom: clamp(0.5rem, 1.5vw, 0.75rem);
          padding-left: clamp(1rem, 3vw, 1.5rem);
          position: relative;
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .list-item::before {
          content: '•';
          position: absolute;
          left: 0;
          color: #6b7280;
          font-weight: 700;
        }

        .highlight-box {
          background: linear-gradient(135deg, #f3f4f6 0%, #f9fafb 100%);
          border-left: 4px solid #6b7280;
          padding: clamp(1rem, 3vw, 1.5rem);
          border-radius: 8px;
          margin: clamp(1rem, 3vw, 1.5rem) 0;
        }

        .highlight-box.warning {
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          border-left-color: #ef4444;
        }

        .highlight-box.important {
          background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
          border-left-color: #3b82f6;
        }

        .pricing-table {
          margin: clamp(1rem, 3vw, 1.5rem) 0;
        }

        .pricing-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: clamp(0.75rem, 2vw, 1rem) clamp(1rem, 3vw, 1.5rem);
          background: #f9fafb;
          border-radius: 8px;
          margin-bottom: clamp(0.5rem, 1.5vw, 0.75rem);
          transition: all 0.3s;
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .pricing-row:hover {
          background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
          transform: translateX(5px);
        }

        .contact-box {
          background: #f9fafb;
          padding: clamp(1rem, 3vw, 1.5rem);
          border-radius: 12px;
          margin-top: clamp(1rem, 3vw, 1.5rem);
        }

        .contact-item {
          margin-bottom: clamp(0.375rem, 1vw, 0.5rem);
          color: #4b5563;
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .agreement-section {
          background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
          padding: clamp(1.5rem, 4vw, 2rem);
          border-top: 1px solid #e5e7eb;
        }

        .checkbox-container {
          display: flex;
          align-items: flex-start;
          margin-bottom: clamp(1rem, 3vw, 1.5rem);
          cursor: pointer;
        }

        .checkbox-container input[type="checkbox"] {
          width: clamp(18px, 3vw, 20px);
          height: clamp(18px, 3vw, 20px);
          margin-right: clamp(0.75rem, 2vw, 1rem);
          margin-top: 2px;
          cursor: pointer;
        }

        .checkbox-label {
          color: #374151;
          line-height: 1.6;
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .checkbox-label a {
          color: #6b7280;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s;
        }

        .checkbox-label a:hover {
          color: #4b5563;
          text-decoration: underline;
        }

        .action-buttons {
          display: flex;
          gap: clamp(0.75rem, 2vw, 1rem);
        }

        .btn {
          flex: 1;
          padding: clamp(0.75rem, 2vw, 1rem) clamp(1.5rem, 4vw, 2rem);
          border-radius: 12px;
          font-size: clamp(0.875rem, 2vw, 1rem);
          font-weight: 600;
          text-align: center;
          transition: all 0.3s;
          text-decoration: none;
          display: inline-block;
          border: none;
          cursor: pointer;
        }

        .btn-secondary {
          background: white;
          color: #4b5563;
          border: 2px solid #e5e7eb;
        }

        .btn-secondary:hover {
          background: #f9fafb;
          border-color: #d1d5db;
          transform: translateY(-2px);
        }

        .btn-primary {
          background: linear-gradient(135deg, #6b7280, #4b5563);
          color: white;
          box-shadow: 0 4px 20px rgba(107, 114, 128, 0.3);
        }

        .btn-primary:hover {
          box-shadow: 0 6px 30px rgba(107, 114, 128, 0.4);
          transform: translateY(-2px);
        }

        .btn-disabled {
          background: #d1d5db;
          color: #9ca3af;
          cursor: not-allowed;
          box-shadow: none;
        }

        .btn-disabled:hover {
          transform: none;
        }

        .footer-info {
          text-align: center;
          margin-top: clamp(2rem, 5vw, 3rem);
          padding: 0 clamp(1rem, 3vw, 1.5rem) clamp(2rem, 5vw, 3rem);
          color: white;
        }

        .footer-text {
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(10px);
          display: inline-block;
          padding: clamp(0.75rem, 2vw, 1rem) clamp(1.5rem, 4vw, 2rem);
          border-radius: 50px;
          margin-bottom: clamp(0.375rem, 1vw, 0.5rem);
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        /* レスポンシブデザイン: 275px〜1440px対応 */
        @media (max-width: 640px) {
          .progress-steps {
            flex-direction: column;
            gap: clamp(0.75rem, 3vw, 1rem);
          }

          .step-connector {
            display: none;
          }

          .progress-step {
            width: 100%;
          }

          .action-buttons {
            flex-direction: column;
          }
        }

        @media (min-width: 1440px) {
          .header-content,
          .main-content {
            max-width: 1440px;
          }
        }
      `}</style>

      <div className="page-container">
        {/* ヘッダー */}
        <header className="header">
          <div className="header-content">
            <div className="logo">
              GAS Generator
            </div>
            <div className="plan-badge">
              {currentPlan.name}
            </div>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="main-content">
          {/* プログレスインジケーター */}
          <div className="progress-bar">
            <div className="progress-steps">
              <div className="progress-step">
                <div className="step-circle completed">1</div>
                <span className="step-label">プラン選択</span>
              </div>
              <div className="step-connector"></div>
              <div className="progress-step">
                <div className="step-circle active">2</div>
                <span className="step-label">利用規約</span>
              </div>
              <div className="step-connector"></div>
              <div className="progress-step">
                <div className="step-circle pending">3</div>
                <span className="step-label">決済</span>
              </div>
            </div>
          </div>

          {/* 利用規約カード */}
          <div className="terms-card">
            <div className="card-header">
              <h1 className="card-title">利用規約</h1>
              <p className="card-subtitle">最終更新日: 2025年1月17日</p>
            </div>

            <div className="terms-content">
              <section className="section">
                <h2 className="section-title">第1条（利用規約の適用）</h2>
                <div className="section-content">
                  <p>
                    本利用規約（以下「本規約」）は、株式会社IKEMEN（以下「当社」）が提供するGAS Generator（以下「本サービス」）の利用条件を定めるものです。
                    利用者は、本規約に同意の上、本サービスを利用するものとします。
                  </p>
                </div>
              </section>

              <section className="section">
                <h2 className="section-title">第2条（サービス内容）</h2>
                <div className="section-content">
                  <div className="list-item">Google Apps Script（GAS）コードの自動生成</div>
                  <div className="list-item">生成コードの修正・カスタマイズサポート</div>
                  <div className="list-item">エラー解決支援</div>
                  <div className="list-item">画像解析によるコード生成</div>
                  <div className="list-item">エンジニアサポート（プラン別）</div>
                </div>
              </section>

              <section className="section">
                <h2 className="section-title">第3条（料金および支払い）</h2>
                <div className="highlight-box important">
                  <p style={{ fontWeight: 'bold', marginBottom: '0.75rem', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>
                    最低契約期間: 3ヶ月（全有料プラン共通）
                  </p>
                  <div className="list-item">最低3ヶ月間の継続が必要です</div>
                  <div className="list-item">月額料金のみ（頭金・初期費用なし）</div>
                  <div className="list-item">3ヶ月経過後はいつでも解約可能</div>
                </div>
                <div className="highlight-box">
                  <div className="pricing-table">
                    <div className="pricing-row">
                      <strong>無料プラン</strong>
                      <span>月10回まで（0円）</span>
                    </div>
                    <div className="pricing-row">
                      <strong>プレミアムプラン</strong>
                      <span>無制限利用（月額10,000円・税込）</span>
                    </div>
                    <div className="pricing-row">
                      <strong>プロフェッショナルプラン</strong>
                      <span>無制限利用＋優先サポート（月額50,000円・税込）</span>
                    </div>
                  </div>
                </div>
                <div className="section-content">
                  <div className="list-item">料金は前払い制とし、毎月自動更新されます</div>
                  <div className="list-item">決済はStripeを通じて安全に処理されます</div>
                  <div className="list-item">日割り計算は行いません</div>
                  <div className="list-item">解約は次回更新日の5日前までに申請（最低契約期間3ヶ月経過後）</div>
                </div>
              </section>

              <section className="section">
                <h2 className="section-title">第4条（禁止事項）</h2>
                <div className="section-content">
                  <div className="list-item">本サービスを利用した違法行為</div>
                  <div className="list-item">サーバーへの不正アクセスや過度な負荷をかける行為</div>
                  <div className="list-item">生成コードを悪用した第三者への損害を与える行為</div>
                  <div className="list-item">本サービスのリバースエンジニアリング</div>
                  <div className="list-item">複数アカウントの不正作成</div>
                  <div className="list-item">他者へのアカウント貸与・転売</div>
                </div>
              </section>

              <section className="section">
                <h2 className="section-title">第5条（知的財産権）</h2>
                <div className="section-content">
                  <div className="list-item">生成されたコードの著作権は利用者に帰属します</div>
                  <div className="list-item">本サービス自体の著作権・商標権等は当社に帰属します</div>
                  <div className="list-item">利用者は生成コードを自由に改変・商用利用できます</div>
                </div>
              </section>

              <section className="section">
                <h2 className="section-title">第6条（免責事項）</h2>
                <div className="highlight-box warning">
                  <p>
                    <strong>重要:</strong> 当社は生成コードの完全性、正確性、有用性を保証しません。
                    生成コードの利用により生じた損害について、当社は一切の責任を負いません。
                  </p>
                </div>
                <div className="section-content">
                  <div className="list-item">システムメンテナンスによるサービス停止</div>
                  <div className="list-item">天災・不可抗力によるサービス中断</div>
                  <div className="list-item">生成コードのバグや不具合</div>
                  <div className="list-item">第三者サービス（Google等）の仕様変更による影響</div>
                </div>
              </section>

              <section className="section">
                <h2 className="section-title">第7条（返金ポリシー）</h2>
                <div className="section-content">
                  <div className="list-item"><strong>クーリングオフ:</strong> 初回申込から7日間は全額返金可能</div>
                  <div className="list-item"><strong>最低契約期間:</strong> 3ヶ月未満での解約でも、3ヶ月分の料金が発生します</div>
                  <div className="list-item"><strong>サービス不具合:</strong> 当社起因の重大な不具合の場合、日割り返金</div>
                  <div className="list-item"><strong>返金申請:</strong> support@ikemen.co.jp まで連絡</div>
                  <div className="list-item"><strong>処理期間:</strong> 申請から5営業日以内に処理</div>
                </div>
              </section>

              <section className="section">
                <h2 className="section-title">第8条（個人情報の取扱い）</h2>
                <div className="section-content">
                  <div className="list-item">個人情報は当社プライバシーポリシーに従い適切に管理します</div>
                  <div className="list-item">LINE IDは本人確認とサービス提供のみに使用します</div>
                  <div className="list-item">決済情報はStripeが安全に管理し、当社では保持しません</div>
                  <div className="list-item">第三者への情報提供は法令に基づく場合を除き行いません</div>
                </div>
              </section>

              <section className="section">
                <h2 className="section-title">第9条（サービスの変更・終了）</h2>
                <div className="section-content">
                  <div className="list-item">当社は30日前の通知により、サービス内容を変更できます</div>
                  <div className="list-item">サービス終了の場合、60日前に通知します</div>
                  <div className="list-item">終了時は残存期間分を日割り返金します</div>
                </div>
              </section>

              <section className="section">
                <h2 className="section-title">第10条（準拠法・管轄）</h2>
                <div className="section-content">
                  <div className="list-item">本規約は日本法に準拠します</div>
                  <div className="list-item">紛争が生じた場合、東京地方裁判所を専属的合意管轄とします</div>
                </div>
              </section>

              <section className="section">
                <h2 className="section-title">第11条（お問い合わせ）</h2>
                <div className="contact-box">
                  <div className="contact-item"><strong>運営会社:</strong> 株式会社IKEMEN</div>
                  <div className="contact-item"><strong>メール:</strong> support@ikemen.co.jp</div>
                  <div className="contact-item"><strong>LINE:</strong> @gas-generator</div>
                  <div className="contact-item"><strong>営業時間:</strong> 平日 10:00-19:00（土日祝休み）</div>
                </div>
              </section>
            </div>

            {/* 同意エリア */}
            <div className="agreement-section">
              <div className="checkbox-container">
                <input
                  type="checkbox"
                  id="agreement"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <label htmlFor="agreement" className="checkbox-label">
                  上記の利用規約および
                  <Link href="/privacy">プライバシーポリシー</Link>
                  に同意します
                </label>
              </div>

              <div className="action-buttons">
                <button onClick={() => window.history.back()} className="btn btn-secondary">
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
                  className={`btn ${agreed ? 'btn-primary' : 'btn-disabled'}`}
                >
                  {currentPlan.price}で決済に進む
                </a>
              </div>
            </div>
          </div>

          <div className="footer-info">
            <div className="footer-text">
              決済はStripeで安全に処理されます
            </div>
            <div className="footer-text">
              決済後、LINE公式アカウントに自動的にプランが反映されます
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

export default function TermsOfService() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TermsContent />
    </Suspense>
  )
}