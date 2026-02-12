import React from 'react'

export default function Urgency() {
    return (
        <div className="dark-section-wrapper">
            <section id="urgency" className="section-compact" style={{ background: 'transparent' }}>
                <div className="marker tr" style={{ color: 'rgba(0, 255, 119, 0.4)' }}>SEC.12 // URGENCY</div>
                <div style={{ textAlign: 'center', maxWidth: '900px', margin: '0 auto' }}>
                    <h2 className="h-04" style={{ display: 'inline-block', textAlign: 'left', color: '#ffffff' }}>
                        <small style={{ color: '#00ff77', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.1em' }}>// WHY_NOW</small>
                        なぜ「今」始めるべきなのか
                    </h2>
                </div>

                <div className="urgency-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', maxWidth: '1100px', margin: '50px auto 0' }}>
                    <div className="urgency-item">
                        <div className="urgency-icon">
                            <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="28" height="28"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h4>毎日、時間を失っている</h4>
                        <p>今日も2時間、手作業で消えます。明日も、来月も、来年も。</p>
                        <div className="urgency-calc">
                            <span>1日2時間 × 20日 = <strong>月40時間</strong></span>
                            <span>年間 = <strong>480時間（丸々20日分）</strong></span>
                        </div>
                        <p style={{ color: '#00ff77', fontSize: '0.88rem', marginTop: '12px', fontWeight: 500 }}>時間は、取り戻せません。</p>
                    </div>
                    <div className="urgency-item">
                        <div className="urgency-icon">
                            <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="28" height="28"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h4>手作業は、売上を奪っている</h4>
                        <p>その40時間で、本来何ができましたか？</p>
                        <ul>
                            <li>新規顧客への営業</li>
                            <li>新商品の企画・開発</li>
                            <li>既存顧客へのフォロー</li>
                        </ul>
                        <p style={{ color: '#00ff77', fontSize: '0.88rem', fontWeight: 500 }}>手作業をやめないと、売上は上がりません。</p>
                    </div>
                    <div className="urgency-item">
                        <div className="urgency-icon">
                            <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="28" height="28"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                        </div>
                        <h4>競合は、もう動いている</h4>
                        <p>150社が、すでにTaskMateで自動化を進めています。</p>
                        <div style={{ background: 'rgba(0, 255, 119, 0.06)', border: '1px solid rgba(0, 255, 119, 0.15)', padding: '14px 16px', marginTop: '15px', fontSize: '0.88rem', borderRadius: '4px' }}>
                            <div style={{ color: '#8a9a90', marginBottom: '6px' }}>あなた：毎日2時間、手作業</div>
                            <div style={{ color: '#00ff77', fontWeight: 600 }}>競合：毎日2時間、売上活動</div>
                        </div>
                        <p style={{ color: '#c0d0c5', fontSize: '0.88rem', marginTop: '12px', fontWeight: 500 }}>この差が、業績の差になります。</p>
                    </div>
                    <div className="urgency-item">
                        <div className="urgency-icon">
                            <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="28" height="28"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        </div>
                        <h4>システムは毎月増えている</h4>
                        <p>早く始めれば、新システムが追加されるたびに「これも使える」が増えます。</p>
                        <div style={{ background: 'rgba(0, 255, 119, 0.06)', border: '1px solid rgba(0, 255, 119, 0.15)', padding: '14px 16px', marginTop: '15px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ color: '#8a9a90', fontSize: '0.85rem' }}>現在</span>
                            <span style={{ color: '#00ff77', fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>40</span>
                            <svg fill="none" stroke="#00ff77" strokeWidth="2" viewBox="0 0 24 24" width="20" height="20" style={{ opacity: 0.6 }}><path d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                            <span style={{ color: '#00ff77', fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>300+</span>
                            <span style={{ color: '#8a9a90', fontSize: '0.85rem' }}>システム</span>
                        </div>
                        <p style={{ color: '#a8b8ae', fontSize: '0.88rem', marginTop: '12px' }}>今契約すれば、その恩恵を受けられます。</p>
                    </div>
                </div>

                <div className="p-03-panel" style={{ maxWidth: '700px', margin: '5px auto 0', textAlign: 'center' }}>
                    <p style={{ fontSize: '1.1rem', color: '#e8f0eb', marginBottom: '20px' }}>
                        「来月から始めよう」<br />
                        その1ヶ月で、<span style={{ color: '#00ff77', fontWeight: 700 }}>40時間</span>失います。
                    </p>
                    <a href="https://agency.ikemen.ltd/t/ky0zmcgdoqja" className="b-01" style={{ display: 'inline-flex' }}>
                        <span>今すぐLINEで相談する</span>
                        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '18px', height: '18px' }}><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" /></svg>
                    </a>
                </div>
            </section>
        </div>
    )
}
