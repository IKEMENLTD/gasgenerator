import React from 'react'

export default function RiskReversal() {
    return (
        <section id="risk-reversal" className="section-compact section-layer section-layer-off">
            <div className="marker tl">SEC.11 // RISK_REVERSAL</div>
            <div style={{ textAlign: 'center', maxWidth: '900px', margin: '0 auto' }}>
                <h2 className="h-04" style={{ display: 'inline-block', textAlign: 'left' }}>
                    <small>// ZERO_RISK_GUARANTEE</small>
                    「失敗したらどうしよう」を、<br />ゼロにします
                </h2>
            </div>

            <div className="guarantee-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', maxWidth: '1200px', margin: '50px auto 0' }}>
                <div className="guarantee-card">
                    <div className="guarantee-num">01</div>
                    <h4>動作不良時 返金保証</h4>
                    <p>
                        システムが正常に動作しない場合、30日以内であれば全額返金いたします。<br /><br />
                        不具合が解消できない場合は、LINEで「返金希望」とご連絡ください。
                    </p>
                    <div className="guarantee-tag">品質に自信があります</div>
                </div>
                <div className="guarantee-card">
                    <div className="guarantee-num">02</div>
                    <h4>まずは無料プランで試せる</h4>
                    <p>
                        いきなり契約する必要はありません。<br /><br />
                        「こんなシステムある？」「うちの業務に合う？」まずはLINEで相談してみてください。納得してから契約できます。
                    </p>
                    <div className="guarantee-tag">聞くだけでOK</div>
                </div>
                <div className="guarantee-card">
                    <div className="guarantee-num">03</div>
                    <h4>営業電話は一切しません</h4>
                    <p>
                        LINE追加しても、しつこい営業はしません。電話もかけません。<br /><br />
                        必要なときに、必要な情報だけ送ります。「とりあえずLINE追加してみよう」それで大丈夫です。
                    </p>
                    <div className="guarantee-tag">気軽に始められる</div>
                </div>
                <div className="guarantee-card">
                    <div className="guarantee-num">04</div>
                    <h4>カスタマイズで追加料金なし</h4>
                    <p>
                        「ここだけ変えたい」よくあります。TaskMateなら、追加料金なしで対応。<br /><br />
                        LINEで伝えるだけ。回数制限はありませんが、ボリュームに応じて納期を調整させていただきます。
                    </p>
                    <div className="guarantee-tag">追加料金なし・納期で調整</div>
                </div>
                <div className="guarantee-card">
                    <div className="guarantee-num">05</div>
                    <h4>LINEサポート平均5分以内返信</h4>
                    <p>
                        「使い方が分からない」「エラーが出た」何でもLINEで聞いてください。<br /><br />
                        平均5分以内に返信。「困ったときに誰にも聞けない」は、ありません。
                    </p>
                    <div className="guarantee-tag">平日10:00-18:00対応</div>
                </div>
            </div>
        </section>
    )
}
