import React from 'react'

export default function Hero() {
    return (
        <section id="hero" className="section-layer section-layer-hero">
            <div className="marker tl">SEC.01 // HERO</div>

            <div style={{ zIndex: 2, maxWidth: '850px' }}>
                <div className="badge" style={{ marginBottom: '25px' }}>導入企業150社+ / 継続率95%</div>
                <h1 className="hero-title">
                    <span className="hero-line">毎日2時間、</span>
                    <span className="highlight"><span className="hero-line">スプレッドシートと</span><span className="hero-line">格闘していませんか？</span></span>
                </h1>
                <p className="lead-text" style={{ fontSize: '1.15rem', lineHeight: 2.2 }}>
                    その作業、もう終わりにできます。<br />
                    プロが作った業務システム<strong style={{ color: 'var(--force)' }}>300本以上</strong>から、<br />
                    欲しいものを選んで、今日から使うだけ。
                </p>
                <div style={{ marginTop: '40px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <a href="https://agency.ikemen.ltd/t/ky0zmcgdoqja" className="b-01">
                        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '22px', height: '22px', marginRight: '10px' }}>
                            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" /></svg>
                        LINE追加して無料で始める
                    </a>
                    <a href="#catalog" className="b-02">システムカタログを見る</a>
                </div>
                <div className="hero-badges" style={{ marginTop: '30px' }}>
                    <span className="badge badge-outline">導入企業150社以上</span>
                    <span className="badge badge-outline">継続率95%</span>
                    <span className="badge badge-outline">動作不良時返金保証</span>
                    <span className="badge badge-outline">最短5分で導入</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#7a8f80', marginTop: '20px', marginBottom: '60px' }}>
                    ※ 営業電話は一切しません / 無料プランで試してから決められます
                </p>
            </div>
        </section>
    )
}
