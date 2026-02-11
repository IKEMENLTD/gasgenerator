'use client'

import Link from 'next/link'

export default function LegalPage() {
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
          max-width: 1200px;
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
        }

        .main-content {
          max-width: 1000px;
          margin: clamp(1.5rem, 5vw, 3rem) auto;
          padding: 0 clamp(1rem, 3vw, 1.5rem);
          position: relative;
          z-index: 5;
        }

        .legal-card {
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

        .card-content {
          padding: clamp(1.5rem, 4vw, 3rem);
        }

        .legal-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 2rem;
        }

        .legal-table th,
        .legal-table td {
          padding: 1.2rem;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
          font-size: clamp(0.875rem, 2vw, 1rem);
          line-height: 1.6;
        }

        .legal-table th {
          width: 30%;
          background-color: #f9fafb;
          font-weight: 600;
          color: #374151;
        }

        .legal-table td {
          color: #4b5563;
        }

        @media (max-width: 640px) {
          .legal-table th,
          .legal-table td {
            display: block;
            width: 100%;
          }
          
          .legal-table th {
            padding-bottom: 0.5rem;
            border-bottom: none;
          }
          
          .legal-table td {
            padding-top: 0.2rem;
          }
        }

        .footer {
          margin-top: 3rem;
          text-align: center;
        }

        .btn-back {
          display: inline-block;
          padding: 0.75rem 2rem;
          background: white;
          color: #4b5563;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-back:hover {
          background: #f3f4f6;
        }
      `}</style>

      <div className="page-container">
        <header className="header">
          <div className="header-content">
            <Link href="/" className="logo">
              Task mate
            </Link>
          </div>
        </header>

        <main className="main-content">
          <div className="legal-card">
            <div className="card-header">
              <h1 className="card-title">特定商取引法に基づく表記</h1>
            </div>

            <div className="card-content">
              <table className="legal-table">
                <tbody>
                  <tr>
                    <th>販売業者</th>
                    <td>株式会社イケメン</td>
                  </tr>
                  <tr>
                    <th>運営統括責任者</th>
                    <td>沼倉 隆平</td>
                  </tr>
                  <tr>
                    <th>所在地</th>
                    <td>東京都品川区大崎4丁目4-24</td>
                  </tr>
                  <tr>
                    <th>電話番号</th>
                    <td>050-8890-8975 <br /><span style={{ fontSize: '0.85em', color: '#6b7280' }}>※サービスに関するお問い合わせは、原則としてLINE公式アカウントまたはメールにて承っております。</span></td>
                  </tr>
                  <tr>
                    <th>メールアドレス</th>
                    <td>info@ikemen.ltd</td>
                  </tr>
                  <tr>
                    <th>販売価格</th>
                    <td>
                      <div><strong>プレミアムプラン（1万円プラン）:</strong> 月額10,000円（税込）</div>
                      <div><strong>プロフェッショナルプラン（5万円プラン）:</strong> 月額50,000円（税込）</div>
                    </td>
                  </tr>
                  <tr>
                    <th>商品代金以外の必要料金</th>
                    <td>インターネット接続料金、通信料金等はお客様のご負担となります。</td>
                  </tr>
                  <tr>
                    <th>支払方法</th>
                    <td>クレジットカード決済（Stripe）</td>
                  </tr>
                  <tr>
                    <th>支払時期</th>
                    <td>初回申込み時および翌月以降毎月（自動更新）</td>
                  </tr>
                  <tr>
                    <th>役務の提供時期</th>
                    <td>決済完了後、直ちにご利用いただけます。</td>
                  </tr>
                  <tr>
                    <th>キャンセル・返金について</th>
                    <td>
                      <div><strong>7日間全額返金保証:</strong> 初回申込から7日間は理由を問わず全額返金いたします。</div>
                      <div><strong>30日以内返金制度:</strong> 初回申込から30日以内、所定の条件を満たす場合に返金申請が可能です。</div>
                      <div><strong>途中解約:</strong> 最低契約期間（6ヶ月）経過後は、次回更新日の10営業日前までの申請により解約可能です。期間満了前の解約には残存期間分の料金が発生します。</div>
                    </td>
                  </tr>
                  <tr>
                    <th>動作環境</th>
                    <td>
                      <div>Google Chrome 最新版</div>
                      <div>Google スプレッドシートが動作する環境</div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="footer">
                <Link href="/" className="btn-back">
                  トップページに戻る
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
