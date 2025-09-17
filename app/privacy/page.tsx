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
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          position: relative;
          overflow: hidden;
        }

        .privacy-container::before {
          content: '';
          position: absolute;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
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
          max-width: 1200px;
          margin: 0 auto;
          padding: 1.5rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .privacy-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 1.5rem;
          font-weight: 700;
          color: #1a202c;
          text-decoration: none;
          transition: transform 0.2s;
        }

        .privacy-logo:hover {
          transform: translateY(-2px);
        }

        .back-link {
          color: #667eea;
          text-decoration: none;
          font-size: 0.875rem;
          font-weight: 600;
          transition: color 0.2s;
          padding: 0.5rem 1rem;
          border: 2px solid #667eea;
          border-radius: 8px;
        }

        .back-link:hover {
          color: #764ba2;
          border-color: #764ba2;
          background: rgba(102, 126, 234, 0.05);
        }

        .privacy-main {
          max-width: 900px;
          margin: 3rem auto;
          padding: 0 1.5rem;
          position: relative;
          z-index: 5;
        }

        .privacy-card {
          background: white;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        }

        .privacy-card-header {
          background: linear-gradient(135deg, #764ba2, #667eea);
          padding: 2.5rem;
          color: white;
        }

        .privacy-title {
          font-size: 2.25rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .privacy-subtitle {
          font-size: 1rem;
          opacity: 0.9;
        }

        .privacy-content {
          padding: 3rem;
          max-height: 600px;
          overflow-y: auto;
        }

        .privacy-content::-webkit-scrollbar {
          width: 8px;
        }

        .privacy-content::-webkit-scrollbar-track {
          background: #f7fafc;
          border-radius: 10px;
        }

        .privacy-content::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #764ba2, #667eea);
          border-radius: 10px;
        }

        .privacy-section {
          margin-bottom: 2.5rem;
        }

        .privacy-section-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #e2e8f0;
        }

        .privacy-text {
          color: #4a5568;
          line-height: 1.8;
          margin-bottom: 1rem;
        }

        .privacy-list {
          list-style: none;
          padding: 0;
        }

        .privacy-list-item {
          color: #4a5568;
          line-height: 1.8;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
          position: relative;
        }

        .privacy-list-item::before {
          content: '•';
          position: absolute;
          left: 0;
          color: #764ba2;
          font-weight: 700;
        }

        .info-box {
          background: linear-gradient(135deg, #f0f4ff 0%, #f6f9ff 100%);
          border-left: 4px solid #667eea;
          padding: 1.5rem;
          border-radius: 8px;
          margin: 1.5rem 0;
        }

        .info-box-title {
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 0.75rem;
        }

        .info-box-list {
          list-style: none;
          padding: 0;
        }

        .info-box-item {
          color: #4a5568;
          padding: 0.25rem 0;
          display: flex;
          align-items: flex-start;
        }

        .info-box-item::before {
          content: '✓';
          color: #48bb78;
          font-weight: 700;
          margin-right: 0.5rem;
        }

        .service-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
          margin: 1.5rem 0;
        }

        .service-card {
          background: #f7fafc;
          padding: 1.25rem;
          border-radius: 12px;
          transition: all 0.3s;
          border: 2px solid transparent;
        }

        .service-card:hover {
          background: linear-gradient(135deg, #f0f4ff 0%, #f6f9ff 100%);
          border-color: #667eea;
          transform: translateY(-2px);
        }

        .service-title {
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 0.5rem;
        }

        .service-desc {
          font-size: 0.875rem;
          color: #718096;
          line-height: 1.5;
        }

        .data-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin: 1.5rem 0;
          overflow: hidden;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }

        .data-table thead {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
        }

        .data-table th {
          padding: 1rem 1.5rem;
          text-align: left;
          font-weight: 600;
        }

        .data-table tbody tr {
          background: white;
          transition: background 0.2s;
        }

        .data-table tbody tr:nth-child(even) {
          background: #f7fafc;
        }

        .data-table tbody tr:hover {
          background: linear-gradient(135deg, #f0f4ff 0%, #f6f9ff 100%);
        }

        .data-table td {
          padding: 1rem 1.5rem;
          color: #4a5568;
        }

        .rights-box {
          background: linear-gradient(135deg, #f5e6ff 0%, #f0e6ff 100%);
          border-left: 4px solid #764ba2;
          padding: 1.5rem;
          border-radius: 8px;
          margin: 1.5rem 0;
        }

        .rights-list {
          list-style: none;
          padding: 0;
          margin-top: 1rem;
        }

        .rights-item {
          display: flex;
          align-items: flex-start;
          margin-bottom: 0.75rem;
        }

        .rights-icon {
          margin-right: 0.75rem;
          color: #764ba2;
          font-weight: 700;
        }

        .rights-text {
          color: #4a5568;
        }

        .contact-section {
          background: #f7fafc;
          padding: 1.5rem;
          border-radius: 12px;
          margin-top: 1.5rem;
        }

        .contact-title {
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 1rem;
        }

        .contact-info {
          color: #4a5568;
          line-height: 1.8;
        }

        .privacy-footer {
          background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
          padding: 2rem;
          border-top: 1px solid #e2e8f0;
        }

        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .copyright {
          color: #718096;
          font-size: 0.875rem;
        }

        .footer-link {
          color: #667eea;
          text-decoration: none;
          font-weight: 600;
          font-size: 0.875rem;
          transition: color 0.2s;
        }

        .footer-link:hover {
          color: #764ba2;
          text-decoration: underline;
        }

        @media (max-width: 768px) {
          .privacy-main {
            margin: 2rem auto;
          }

          .privacy-content {
            padding: 1.5rem;
          }

          .service-grid {
            grid-template-columns: 1fr;
          }

          .data-table {
            font-size: 0.875rem;
          }

          .data-table th,
          .data-table td {
            padding: 0.75rem;
          }

          .footer-content {
            flex-direction: column;
            gap: 1rem;
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
                <p className="privacy-text" style={{ fontSize: '0.875rem', color: '#718096' }}>
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
                <div className="info-box" style={{ borderLeftColor: '#48bb78', background: 'linear-gradient(135deg, #f0fff4 0%, #f7fff7 100%)' }}>
                  <p className="info-box-title">原則として第三者提供は行いません</p>
                  <p className="privacy-text" style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>以下の場合を除く：</p>
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
                  <p className="privacy-text" style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
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