'use client'

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
                        プロが作った300本以上の業務システムから、<br />
                        あなたの会社に最適なツールを選んで導入。<br />
                        最短5分で、手作業のない未来へ。
                    </p>
                </div>
                <div className="footer-links">
                    <h5>// SERVICE</h5>
                    <ul>
                        <li><a href="/#features">機能一覧</a></li>
                        <li><a href="/systems/catalog">システムカタログ</a></li>
                        <li><a href="/#pricing">料金プラン</a></li>
                    </ul>
                </div>
                <div className="footer-links">
                    <h5>// LEGAL</h5>
                    <ul>
                        <li><a href="/terms">利用規約</a></li>
                        <li><a href="/legal">特定商取引法に基づく表記</a></li>
                        <li><a href="/privacy">プライバシーポリシー</a></li>
                    </ul>
                </div>
                <div className="footer-links">
                    <h5>// SUPPORT</h5>
                    <ul>
                        <li><a href="/#faq">よくある質問</a></li>
                        <li><a href="/#contact">お問い合わせ</a></li>
                    </ul>
                </div>
            </div>
            <div className="footer-bottom">
                <div>&copy; 2025 TaskMate. All rights reserved.</div>
                <div>Designed by <a href="#" target="_blank" className="text-force">Antigravity</a></div>
            </div>
        </footer>
    )
}
