'use client'

import Link from 'next/link'

export default function PrivacyPolicy() {
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

        .privacy-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
          position: relative;
          overflow: hidden;
        }

        .privacy-container::before {
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

        .privacy-header {
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(20px);
          box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
          position: relative;
          z-index: 10;
        }

        .privacy-header-content {
          max-width: 1440px;
          margin: 0 auto;
          padding: clamp(1rem, 3vw, 1.5rem) clamp(1rem, 4vw, 2rem);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .privacy-logo {
          display: flex;
          align-items: center;
          gap: clamp(0.5rem, 2vw, 0.75rem);
          font-size: clamp(1.125rem, 3vw, 1.5rem);
          font-weight: 700;
          color: #1f2937;
          text-decoration: none;
          transition: transform 0.2s;
        }

        .privacy-logo:hover {
          transform: translateY(-2px);
        }

        .back-link {
          color: #6b7280;
          text-decoration: none;
          font-size: clamp(0.75rem, 2vw, 0.875rem);
          font-weight: 600;
          transition: all 0.2s;
          padding: clamp(0.375rem, 2vw, 0.5rem) clamp(0.75rem, 3vw, 1rem);
          border: 2px solid #6b7280;
          border-radius: 8px;
        }

        .back-link:hover {
          color: #4b5563;
          border-color: #4b5563;
          background: rgba(107, 114, 128, 0.05);
        }

        .privacy-main {
          max-width: 1200px;
          margin: clamp(1.5rem, 5vw, 3rem) auto;
          padding: 0 clamp(1rem, 3vw, 1.5rem);
          position: relative;
          z-index: 5;
        }

        .privacy-card {
          background: white;
          border-radius: clamp(12px, 3vw, 24px);
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        }

        .privacy-card-header {
          background: linear-gradient(135deg, #4b5563, #6b7280);
          padding: clamp(1.5rem, 4vw, 2.5rem);
          color: white;
        }

        .privacy-title {
          font-size: clamp(1.5rem, 4vw, 2.25rem);
          font-weight: 700;
          margin-bottom: clamp(0.25rem, 1vw, 0.5rem);
        }

        .privacy-subtitle {
          font-size: clamp(0.875rem, 2vw, 1rem);
          opacity: 0.9;
        }

        .privacy-content {
          padding: clamp(1.5rem, 4vw, 3rem);
          max-height: 70vh;
          overflow-y: auto;
        }

        .privacy-content::-webkit-scrollbar {
          width: 8px;
        }

        .privacy-content::-webkit-scrollbar-track {
          background: #f9fafb;
          border-radius: 10px;
        }

        .privacy-content::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #4b5563, #6b7280);
          border-radius: 10px;
        }

        .privacy-section {
          margin-bottom: clamp(1.5rem, 4vw, 2.5rem);
        }

        .privacy-section-title {
          font-size: clamp(1rem, 2.5vw, 1.25rem);
          font-weight: 700;
          color: #1f2937;
          margin-bottom: clamp(0.75rem, 2vw, 1rem);
          padding-bottom: clamp(0.375rem, 1vw, 0.5rem);
          border-bottom: 2px solid #e5e7eb;
        }

        .privacy-text {
          color: #4b5563;
          line-height: 1.8;
          margin-bottom: clamp(0.75rem, 2vw, 1rem);
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .privacy-list {
          list-style: none;
          padding: 0;
        }

        .privacy-list-item {
          color: #4b5563;
          line-height: 1.8;
          padding-left: clamp(1rem, 3vw, 1.5rem);
          margin-bottom: clamp(0.5rem, 1.5vw, 0.75rem);
          position: relative;
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .privacy-list-item::before {
          content: '•';
          position: absolute;
          left: 0;
          color: #6b7280;
          font-weight: 700;
        }

        .info-box {
          background: linear-gradient(135deg, #f3f4f6 0%, #f9fafb 100%);
          border-left: 4px solid #6b7280;
          padding: clamp(1rem, 3vw, 1.5rem);
          border-radius: 8px;
          margin: clamp(1rem, 3vw, 1.5rem) 0;
        }

        .info-box-title {
          font-weight: 700;
          color: #374151;
          margin-bottom: clamp(0.5rem, 1.5vw, 0.75rem);
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .info-box-list {
          list-style: none;
          padding: 0;
        }

        .info-box-item {
          color: #4b5563;
          padding: clamp(0.25rem, 0.75vw, 0.375rem) 0;
          display: flex;
          align-items: flex-start;
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .info-box-item::before {
          content: '✓';
          color: #10b981;
          font-weight: 700;
          margin-right: clamp(0.375rem, 1vw, 0.5rem);
        }

        .service-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: clamp(0.75rem, 2vw, 1rem);
          margin: clamp(1rem, 3vw, 1.5rem) 0;
        }

        .service-card {
          background: #f9fafb;
          padding: clamp(1rem, 3vw, 1.25rem);
          border-radius: 12px;
          transition: all 0.3s;
          border: 2px solid transparent;
        }

        .service-card:hover {
          background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
          border-color: #6b7280;
          transform: translateY(-2px);
        }

        .service-title {
          font-weight: 700;
          color: #374151;
          margin-bottom: clamp(0.375rem, 1vw, 0.5rem);
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .service-desc {
          font-size: clamp(0.75rem, 1.75vw, 0.875rem);
          color: #6b7280;
          line-height: 1.5;
        }

        .data-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin: clamp(1rem, 3vw, 1.5rem) 0;
          overflow: hidden;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }

        .data-table thead {
          background: linear-gradient(135deg, #6b7280, #4b5563);
          color: white;
        }

        .data-table th {
          padding: clamp(0.75rem, 2vw, 1rem) clamp(1rem, 3vw, 1.5rem);
          text-align: left;
          font-weight: 600;
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .data-table tbody tr {
          background: white;
          transition: background 0.2s;
        }

        .data-table tbody tr:nth-child(even) {
          background: #f9fafb;
        }

        .data-table tbody tr:hover {
          background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
        }

        .data-table td {
          padding: clamp(0.75rem, 2vw, 1rem) clamp(1rem, 3vw, 1.5rem);
          color: #4b5563;
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .rights-box {
          background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%);
          border-left: 4px solid #3b82f6;
          padding: clamp(1rem, 3vw, 1.5rem);
          border-radius: 8px;
          margin: clamp(1rem, 3vw, 1.5rem) 0;
        }

        .rights-list {
          list-style: none;
          padding: 0;
          margin-top: clamp(0.75rem, 2vw, 1rem);
        }

        .rights-item {
          display: flex;
          align-items: flex-start;
          margin-bottom: clamp(0.5rem, 1.5vw, 0.75rem);
        }

        .rights-icon {
          margin-right: clamp(0.5rem, 1.5vw, 0.75rem);
          color: #3b82f6;
          font-weight: 700;
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .rights-text {
          color: #4b5563;
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .contact-section {
          background: #f9fafb;
          padding: clamp(1rem, 3vw, 1.5rem);
          border-radius: 12px;
          margin-top: clamp(1rem, 3vw, 1.5rem);
        }

        .contact-title {
          font-weight: 700;
          color: #374151;
          margin-bottom: clamp(0.75rem, 2vw, 1rem);
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .contact-info {
          color: #4b5563;
          line-height: 1.8;
          font-size: clamp(0.875rem, 2vw, 1rem);
        }

        .privacy-footer {
          background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
          padding: clamp(1.5rem, 4vw, 2rem);
          border-top: 1px solid #e5e7eb;
        }

        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: clamp(0.75rem, 2vw, 1rem);
        }

        .copyright {
          color: #6b7280;
          font-size: clamp(0.75rem, 2vw, 0.875rem);
        }

        .footer-link {
          color: #6b7280;
          text-decoration: none;
          font-weight: 600;
          font-size: clamp(0.75rem, 2vw, 0.875rem);
          transition: color 0.2s;
        }

        .footer-link:hover {
          color: #4b5563;
          text-decoration: underline;
        }

        /* レスポンシブデザイン: 275px〜1440px対応 */
        @media (max-width: 640px) {
          .service-grid {
            grid-template-columns: 1fr;
          }

          .data-table {
            font-size: clamp(0.75rem, 2vw, 0.875rem);
          }

          .footer-content {
            flex-direction: column;
            text-align: center;
          }
        }

        @media (min-width: 1440px) {
          .privacy-header-content,
          .privacy-main {
            max-width: 1440px;
          }
        }
      `}</style>

      <div className="privacy-container">
        <header className="privacy-header">
          <div className="privacy-header-content">
            <div className="privacy-logo">
              GAS Generator
            </div>
            <Link href="/terms" className="back-link">
              利用規約に戻る
            </Link>
          </div>
        </header>

        <main className="privacy-main">
          <div className="privacy-card">
            <div className="privacy-card-header">
              <h1 className="privacy-title">プライバシーポリシー</h1>
              <p className="privacy-subtitle">最終更新日: 2025年1月17日</p>
            </div>

            <div className="privacy-content">
              <section className="privacy-section">
                <p className="privacy-text">
                  株式会社IKEMEN（以下「当社」）は、GAS Generator（以下「本サービス」）における
                  個人情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。
                </p>
              </section>

              <section className="privacy-section">
                <h2 className="privacy-section-title">1. 収集する情報</h2>
                <div className="info-box">
                  <p className="info-box-title">当社が収集する情報：</p>
                  <ul className="info-box-list">
                    <li className="info-box-item">LINE ユーザーID（識別用）</li>
                    <li className="info-box-item">LINE 表示名（コミュニケーション用）</li>
                    <li className="info-box-item">利用履歴（サービス改善用）</li>
                    <li className="info-box-item">生成したコード内容（サポート用）</li>
                    <li className="info-box-item">エラーログ（品質改善用）</li>
                  </ul>
                </div>
                <p className="privacy-text" style={{ fontSize: 'clamp(0.75rem, 1.75vw, 0.875rem)', color: '#6b7280' }}>
                  ※ クレジットカード情報はStripe社が管理し、当社では保持しません
                </p>
              </section>

              <section className="privacy-section">
                <h2 className="privacy-section-title">2. 情報の利用目的</h2>
                <ul className="privacy-list">
                  <li className="privacy-list-item"><strong>サービス提供:</strong> コード生成、カスタマイズ、エラー解決支援</li>
                  <li className="privacy-list-item"><strong>ユーザーサポート:</strong> お問い合わせ対応、技術支援</li>
                  <li className="privacy-list-item"><strong>サービス改善:</strong> 機能改善、新機能開発、UI/UX向上</li>
                  <li className="privacy-list-item"><strong>セキュリティ:</strong> 不正利用防止、システム保護</li>
                  <li className="privacy-list-item"><strong>通知:</strong> 重要なお知らせ、メンテナンス情報</li>
                </ul>
              </section>

              <section className="privacy-section">
                <h2 className="privacy-section-title">3. 第三者提供</h2>
                <div className="info-box" style={{ borderLeftColor: '#10b981', background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)' }}>
                  <p className="info-box-title">原則として第三者提供は行いません</p>
                  <p className="privacy-text" style={{ marginTop: 'clamp(0.5rem, 1.5vw, 0.75rem)', marginBottom: 'clamp(0.375rem, 1vw, 0.5rem)' }}>以下の場合を除く：</p>
                  <ul className="privacy-list">
                    <li className="privacy-list-item">法令に基づく開示要請</li>
                    <li className="privacy-list-item">人命・身体・財産の保護に必要な場合</li>
                    <li className="privacy-list-item">利用者の同意がある場合</li>
                  </ul>
                </div>
              </section>

              <section className="privacy-section">
                <h2 className="privacy-section-title">4. 外部サービスの利用</h2>
                <div className="service-grid">
                  <div className="service-card">
                    <h4 className="service-title">Claude AI (Anthropic)</h4>
                    <p className="service-desc">コード生成処理のみに使用。個人情報は送信しません。</p>
                  </div>
                  <div className="service-card">
                    <h4 className="service-title">Stripe</h4>
                    <p className="service-desc">決済処理。PCI DSS準拠の安全な決済システム。</p>
                  </div>
                  <div className="service-card">
                    <h4 className="service-title">Supabase</h4>
                    <p className="service-desc">データベース管理。SOC 2 Type II認証取得済み。</p>
                  </div>
                  <div className="service-card">
                    <h4 className="service-title">LINE Messaging API</h4>
                    <p className="service-desc">メッセージング機能。LINEプライバシーポリシーに準拠。</p>
                  </div>
                </div>
              </section>

              <section className="privacy-section">
                <h2 className="privacy-section-title">5. データの保管と安全性</h2>
                <ul className="privacy-list">
                  <li className="privacy-list-item">すべての通信はSSL/TLSで暗号化</li>
                  <li className="privacy-list-item">データベースは暗号化して保管</li>
                  <li className="privacy-list-item">アクセス権限は最小限に制限</li>
                  <li className="privacy-list-item">定期的なセキュリティ監査を実施</li>
                  <li className="privacy-list-item">24時間365日の監視体制</li>
                </ul>
              </section>

              <section className="privacy-section">
                <h2 className="privacy-section-title">6. データの保存期間</h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>データ種別</th>
                      <th>保存期間</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>アカウント情報</td>
                      <td>退会後1年間</td>
                    </tr>
                    <tr>
                      <td>生成コード</td>
                      <td>生成後6ヶ月</td>
                    </tr>
                    <tr>
                      <td>会話履歴</td>
                      <td>3ヶ月</td>
                    </tr>
                    <tr>
                      <td>エラーログ</td>
                      <td>30日</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <section className="privacy-section">
                <h2 className="privacy-section-title">7. お客様の権利</h2>
                <div className="rights-box">
                  <p className="info-box-title">以下の権利を行使できます：</p>
                  <ul className="rights-list">
                    <li className="rights-item">
                      <span className="rights-icon">1</span>
                      <span className="rights-text"><strong>開示請求:</strong> 保有個人情報の開示</span>
                    </li>
                    <li className="rights-item">
                      <span className="rights-icon">2</span>
                      <span className="rights-text"><strong>訂正請求:</strong> 誤った情報の訂正</span>
                    </li>
                    <li className="rights-item">
                      <span className="rights-icon">3</span>
                      <span className="rights-text"><strong>削除請求:</strong> 不要な情報の削除</span>
                    </li>
                    <li className="rights-item">
                      <span className="rights-icon">4</span>
                      <span className="rights-text"><strong>利用停止:</strong> 個人情報利用の停止</span>
                    </li>
                  </ul>
                  <p className="privacy-text" style={{ marginTop: 'clamp(0.75rem, 2vw, 1rem)', fontSize: 'clamp(0.75rem, 1.75vw, 0.875rem)' }}>
                    請求方法: support@ikemen.co.jp まで本人確認書類を添えてご連絡ください
                  </p>
                </div>
              </section>

              <section className="privacy-section">
                <h2 className="privacy-section-title">8. Cookie（クッキー）の使用</h2>
                <ul className="privacy-list">
                  <li className="privacy-list-item">セッション管理のための必要最小限のCookieを使用</li>
                  <li className="privacy-list-item">Google Analyticsによるアクセス解析（匿名化済み）</li>
                  <li className="privacy-list-item">広告配信は行いません</li>
                  <li className="privacy-list-item">ブラウザ設定でCookie を無効化可能</li>
                </ul>
              </section>

              <section className="privacy-section">
                <h2 className="privacy-section-title">9. 児童のプライバシー</h2>
                <p className="privacy-text">
                  本サービスは13歳未満の児童を対象としていません。
                  13歳未満の方は保護者の同意を得てご利用ください。
                </p>
              </section>

              <section className="privacy-section">
                <h2 className="privacy-section-title">10. プライバシーポリシーの変更</h2>
                <ul className="privacy-list">
                  <li className="privacy-list-item">変更時はLINE公式アカウントで通知</li>
                  <li className="privacy-list-item">重要な変更は30日前に事前通知</li>
                  <li className="privacy-list-item">最新版は常に本ページで確認可能</li>
                </ul>
              </section>

              <section className="privacy-section">
                <h2 className="privacy-section-title">11. お問い合わせ窓口</h2>
                <div className="contact-section">
                  <p className="contact-title">個人情報管理責任者</p>
                  <div className="contact-info">
                    <p>株式会社IKEMEN プライバシー保護担当</p>
                    <p>メール: privacy@ikemen.co.jp</p>
                    <p>LINE: @gas-generator</p>
                    <p>住所: 東京都渋谷区〇〇 1-2-3</p>
                    <p>対応時間: 平日 10:00-19:00</p>
                  </div>
                </div>
              </section>

              <section className="privacy-section">
                <h2 className="privacy-section-title">12. 準拠法と管轄</h2>
                <p className="privacy-text">
                  本ポリシーは日本法に準拠し、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
                </p>
              </section>
            </div>

            <div className="privacy-footer">
              <div className="footer-content">
                <p className="copyright">
                  © 2025 IKEMEN Ltd. All rights reserved.
                </p>
                <Link href="/terms" className="footer-link">
                  利用規約に戻る
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}