import React from 'react'

export default function Process() {
    return (
        <section id="process" className="section-compact section-layer section-layer-muted">
            <div className="marker tl">SEC.08 // PROCESS</div>
            <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                <div className="jp-sub">導入の流れ</div>
                <h2 className="section-header" style={{ display: 'block', textAlign: 'center' }}>
                    最短5分で業務自動化を実現
                </h2>
                <p className="lead-text" style={{ margin: '20px auto', textAlign: 'center' }}>
                    お申込みから導入まで、経験豊富な専門チームが徹底サポート
                </p>
            </div>

            <div className="process-steps mt-6">
                <div className="process-step">
                    <div className="step-num">1</div>
                    <h4>専用LINE追加</h4>
                    <p>まずは専用のLINEアカウントを友だち追加。</p>
                </div>
                <div className="process-step">
                    <div className="step-num">2</div>
                    <h4>決済リンクから登録</h4>
                    <p>LINEで送られてくる決済リンクから、お好みのプランを選択してサブスクリプション登録を完了。</p>
                </div>
                <div className="process-step">
                    <div className="step-num">3</div>
                    <h4>利用開始</h4>
                    <p>決済完了後、すぐにサービス利用開始。AIによるGASコード生成やサポートを受けられます。</p>
                </div>
                <div className="process-step">
                    <div className="step-num">4</div>
                    <h4>面談・サポート</h4>
                    <p>プロフェッショナルプラン（5万円）の方は運営との面談を実施。全プランでLINEサポートを継続提供。</p>
                </div>
            </div>
        </section>
    )
}
