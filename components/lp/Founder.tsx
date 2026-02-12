import React from 'react'

export default function Founder() {
    return (
        <section id="founder" className="section-compact section-layer section-layer-white">
            <div className="marker tr">SEC.12.5 // MESSAGE</div>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <div className="founder-grid" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '50px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '180px', height: '180px', borderRadius: '50%', overflow: 'hidden', margin: '0 auto', border: '3px solid var(--force)', boxShadow: '0 10px 40px rgba(0, 204, 102, 0.2)' }}>
                            <img src="/images/lp/founder.jpg" alt="代表取締役 沼倉隆平" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ marginTop: '20px' }}>
                            <div style={{ fontWeight: 600, color: '#111', fontSize: '1.1rem' }}>沼倉 隆平</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-mute)', marginTop: '5px' }}>株式会社イケメン<br />代表取締役</div>
                        </div>
                    </div>
                    <div className="founder-message-card">
                        <div className="jp-sub">代表メッセージ</div>
                        <h2 className="section-header">あなたの「面倒」を<br />私たちが解決します</h2>
                        <p>
                            毎日のスプレッドシート作業に追われていませんか？<br /><br />
                            私自身、かつては深夜までデータ入力や集計に時間を取られていました。「この作業、自動化できないかな」と思いながらも、プログラミングの壁に阻まれていました。<br /><br />
                            TaskMateは、そんな過去の自分のために作ったサービスです。LINEで話しかけるだけで、AIがあなたの業務を理解し、最適なGASコードを生成します。<br /><br />
                            <strong style={{ color: 'var(--force)' }}>「誰もが、本来の仕事に集中できる世界を作る」</strong><br /><br />
                            これが私たちのミッションです。まずは無料診断から、あなたの業務改善の可能性を一緒に探りませんか？
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}
