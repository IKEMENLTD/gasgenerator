import React from 'react'

export default function Footer() {
    return (
        <footer>
            <div className="footer-grid">
                <div className="footer-brand">
                    <div className="logo">
                        <div className="mark"><img src="/images/lp/logo.png" alt="TaskMate" /></div>
                        TaskMate
                    </div>
                    <p>
                        AIがLINE経由でGASコード生成をサポート。プログラミングが苦手でも、簡単にスプレッドシートの自動化が実現できます。
                    </p>
                </div>
                <div className="footer-links">
                    <h5>サービス</h5>
                    <ul>
                        <li><a href="#features">機能一覧</a></li>
                        <li><a href="#pricing">料金プラン</a></li>
                        <li><a href="#testimonials">導入事例</a></li>
                        <li><a href="#faq">よくある質問</a></li>
                    </ul>
                </div>
                <div className="footer-links">
                    <h5>会社情報</h5>
                    <ul>
                        <li><a href="#">株式会社イケメン</a></li>
                        <li><a href="#">〒141-0032<br />東京都品川区大崎4丁目4-24</a></li>
                        <li><a href="privacy.html">プライバシーポリシー</a></li>
                        <li><a href="legal.html">特定商取引法に基づく表記</a></li>
                    </ul>
                </div>
                <div className="footer-links">
                    <h5>お問い合わせ</h5>
                    <ul>
                        <li><a href="tel:050-8890-8975">050-8890-8975</a></li>
                        <li><a href="mailto:info@ikemen.ltd">info@ikemen.ltd</a></li>
                        <li>営業時間: 平日 10:00-18:00</li>
                    </ul>
                </div>
            </div>
            <div className="footer-bottom">
                <p>&copy; 2025 株式会社イケメン All rights reserved.</p>
                <a href="https://agency.ikemen.ltd/t/ky0zmcgdoqja" className="btn-core btn-line" style={{ padding: '10px 20px', fontSize: '0.8rem' }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '16px', height: '16px' }}><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" /></svg>
                    LINEで相談
                </a>
            </div>
        </footer>
    )
}
