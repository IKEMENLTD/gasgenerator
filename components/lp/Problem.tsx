import React from 'react'

export default function Problem() {
    return (
        <section id="problem" className="section-compact section-layer section-layer-white">
            <div className="marker tr">SEC.02 // PROBLEM</div>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <div className="jp-sub">CHECK YOUR DAILY TASKS</div>
                <h2 className="h-04"><small>SYS.02</small>まだこんな作業、手でやってますか？</h2>

                <ul className="problem-list" style={{ marginTop: '40px' }}>
                    <li>毎朝、各店舗の売上をスプレッドシートにコピペ</li>
                    <li>月末、請求書を1枚ずつ手作業で作成</li>
                    <li>「あの人、今月来てないな」を頭で覚えてる</li>
                    <li>在庫が切れてから「あ、発注忘れてた」</li>
                    <li>日報、誰も読んでないのに毎日書いてる</li>
                    <li>勤怠データを手作業で集計して給与計算</li>
                    <li>契約更新の期限を、カレンダーで管理してる</li>
                    <li>経費精算の承認を、メールでやり取りしてる</li>
                </ul>

                <div className="p-03-panel" style={{ marginTop: '40px', textAlign: 'center' }}>
                    <div className="scan"></div>
                    <p style={{ fontSize: '1.1rem', color: '#333', lineHeight: 2, margin: 0 }}>
                        <strong>1つでも当てはまるなら、</strong><br />
                        その作業は<span style={{ color: 'var(--force)', fontWeight: 700 }}>「今日」</span>終わらせられます。<br /><br />
                        <span style={{ fontSize: '1.3rem', color: 'var(--force)', fontWeight: 700 }}>全部、自動化できます。</span><br />
                        しかも、あなたが何かを「作る」必要はありません。
                    </p>
                </div>

                <div className="time-loss-box">
                    <h4>// あなたが失っている時間</h4>
                    <div className="calc-row">毎日の手作業：<span className="result">2時間</span></div>
                    <div className="calc-row">月間：2時間 × 20営業日 = <span className="result">40時間</span></div>
                    <div className="calc-row">年間：40時間 × 12ヶ月 = <span className="result">480時間</span></div>
                    <div className="highlight-result">
                        <div className="big">480時間 = 丸々20日分の労働時間</div>
                    </div>
                    <div style={{ marginTop: '25px', color: '#8a9e90', fontSize: '0.95rem', lineHeight: 1.9 }}>
                        この時間で、何ができますか？<br />
                        新規顧客の開拓 / 商品開発 / 家族との時間 / 自分の休息<br /><br />
                        <span style={{ color: 'var(--text-main)' }}>手作業は、あなたの「本当にやるべきこと」を奪っています。</span>
                    </div>
                </div>
            </div>
        </section>
    )
}
