'use client'
import React, { useState } from 'react'

export default function Demo() {
    const [activeTab, setActiveTab] = useState('app')

    return (
        <section id="demo" className="section-compact section-layer section-layer-off">
            <div className="marker tr">SEC.07 // DEMO</div>
            <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                <div className="jp-sub">LIVE DEMO</div>
                <h2 className="section-header" style={{ display: 'block', textAlign: 'center' }}>
                    実際のGASアプリを体験
                </h2>
                <p className="lead-text" style={{ margin: '20px auto', textAlign: 'center' }}>
                    TaskMateで開発した実際のアプリケーションをお試しください<br />
                    下のデモ画面で直接操作できます
                </p>
            </div>

            <div className="demo-container mt-6">
                <div className="demo-tabs">
                    <div
                        className={`demo-tab ${activeTab === 'app' ? 'active' : ''}`}
                        onClick={() => setActiveTab('app')}
                    >
                        アプリケーション画面
                    </div>
                    <div
                        className={`demo-tab ${activeTab === 'database' ? 'active' : ''}`}
                        onClick={() => setActiveTab('database')}
                    >
                        データベース（スプレッドシート）
                    </div>
                    <div
                        className={`demo-tab ${activeTab === 'split' ? 'active' : ''}`}
                        onClick={() => setActiveTab('split')}
                    >
                        同時表示（連携確認）
                    </div>
                </div>
                <div className="demo-frame" id="demo-frame">
                    <iframe
                        id="demo-iframe-app"
                        src="https://syoruitemplate.netlify.app/"
                        style={{ width: '100%', height: '100%', border: 'none', display: activeTab === 'app' ? 'block' : 'none' }}
                        title="アプリケーション画面"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    ></iframe>
                    <iframe
                        id="demo-iframe-database"
                        src="https://drive.google.com/embeddedfolderview?id=13w4pjxY_tn9bbxPDJOYHRDEOIzA6E3Mp#grid"
                        style={{ width: '100%', height: '100%', border: 'none', display: activeTab === 'database' ? 'block' : 'none' }}
                        title="データベース（スプレッドシート）"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    ></iframe>
                    <div id="demo-split-view" style={{ display: activeTab === 'split' ? 'flex' : 'none', width: '100%', height: '100%', gap: 0 }}>
                        <iframe
                            src="https://syoruitemplate.netlify.app/"
                            style={{ width: '50%', height: '100%', border: 'none', borderRight: '1px solid var(--border)' }}
                            title="アプリケーション画面"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        ></iframe>
                        <iframe
                            src="https://drive.google.com/embeddedfolderview?id=13w4pjxY_tn9bbxPDJOYHRDEOIzA6E3Mp#grid"
                            style={{ width: '50%', height: '100%', border: 'none' }}
                            title="データベース（スプレッドシート）"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        ></iframe>
                    </div>
                </div>
                <div style={{ marginTop: '20px', padding: '20px', background: 'rgba(0, 204, 102, 0.05)', borderLeft: '3px solid var(--force)' }}>
                    <h4 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>リアルタイムデータ連携</h4>
                    <p style={{ fontSize: '0.85rem', color: '#6e8274', lineHeight: 1.7 }}>
                        アプリケーションで入力・編集したデータは、即座にGoogleスプレッドシートに反映されます。
                        逆にスプレッドシートの変更も、アプリケーションに自動的に反映される双方向連携を実現。
                    </p>
                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '40px' }}>
                <p style={{ fontSize: '0.9rem', color: '#6e8274', marginBottom: '20px' }}>このようなアプリケーションを御社の業務に合わせてカスタマイズ開発します</p>
                <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <a href="#contact" className="btn-core btn-primary">無料で相談する</a>
                    <a href="https://agency.ikemen.ltd/t/ky0zmcgdoqja" className="btn-core btn-line">
                        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" /></svg>
                        LINEで問い合わせ
                    </a>
                </div>
            </div>
        </section>
    )
}
