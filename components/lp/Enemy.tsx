import React from 'react'

export default function Enemy() {
    return (
        <section id="enemy" className="section-compact section-layer section-layer-white">
            <div className="marker tl">SEC.03 // ENEMY</div>
            <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                <h2 className="section-header" style={{ display: 'block', textAlign: 'center' }}>
                    既存の解決策は、<br />
                    帯に短し襷に長し
                </h2>
            </div>

            <div className="grid-3 mt-6">
                <div className="enemy-card">
                    <div className="enemy-num">01</div>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <span className="price-tag">おなじみ</span>
                        <h4 style={{ display: 'inline' }}>スプレッドシート</h4>
                    </div>
                    <p>
                        「とりあえず無料だし」<br />
                        結局、手入力地獄から抜け出せない。
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, marginTop: '20px' }}>
                        <li><span className="x-mark">×</span> データが増えると重い</li>
                        <li><span className="x-mark">×</span> スマホで入力しづらい</li>
                        <li><span className="x-mark">×</span> 誰かが数式を壊す</li>
                        <li><span className="x-mark">×</span> 結局、コピペ作業</li>
                    </ul>
                    <div className="enemy-conclusion">
                        限界：工数削減にならない
                    </div>
                </div>
                <div className="enemy-card">
                    <div className="enemy-num">02</div>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <span className="price-tag">高すぎる</span>
                        <h4 style={{ display: 'inline' }}>開発会社に外注</h4>
                    </div>
                    <p>
                        「プロに頼めば安心？」<br />
                        見積もりを見て、そっと閉じることに。
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, marginTop: '20px' }}>
                        <li><span className="x-mark">×</span> 初期費用 100万円〜</li>
                        <li><span className="x-mark">×</span> 納期 2〜3ヶ月</li>
                        <li><span className="x-mark">×</span> 修正のたびに追加費用</li>
                        <li><span className="x-mark">×</span> 打ち合わせが面倒</li>
                    </ul>
                    <div className="enemy-conclusion">
                        限界：コストが見合わない
                    </div>
                </div>
                <div className="enemy-card">
                    <div className="enemy-num">03</div>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <span className="price-tag">見つからない</span>
                        <h4 style={{ display: 'inline' }}>エンジニア採用</h4>
                    </div>
                    <p>
                        「社内に詳しい人を」<br />
                        そもそも、応募が来ない。
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, marginTop: '20px' }}>
                        <li><span className="x-mark">×</span> 採用コスト 100万円〜</li>
                        <li><span className="x-mark">×</span> 給与 月50万円〜</li>
                        <li><span className="x-mark">×</span> すぐに辞めるリスク</li>
                        <li><span className="x-mark">×</span> マネジメントコスト</li>
                    </ul>
                    <div className="enemy-conclusion">
                        限界：採用難易度が高すぎる
                    </div>
                </div>
            </div>

            <div className="bridge-panel-wrapper">
                <div className="bridge-panel">
                    <div className="bridge-title">そこで、第4の選択肢</div>
                    <div className="bridge-arrow">▼</div>
                    <div className="main-message">
                        <span className="glitch-text" style={{ display: 'block', marginBottom: '10px' }}>// SYSTEM_LIBRARY_ACCESS</span>
                        エンジニアが作ったシステムを、<br />
                        <span className="big">「選んで使う」</span>
                        という発想。
                    </div>
                    <p style={{ maxWidth: '600px', margin: '0 auto', fontSize: '0.9rem', opacity: 0.9 }}>
                        あなたは、もう「作る」必要はありません。<br />
                        すでに完成された、<strong style={{ color: 'var(--force)' }}>300本以上</strong>のシステム資産を使えばいいのです。
                    </p>
                </div>
            </div>

            <div id="solution">
                <div style={{ textAlign: 'center', marginTop: '60px' }}>
                    <div className="jp-sub">SOLUTION</div>
                    <h2 className="section-header" style={{ display: 'block', textAlign: 'center' }}>
                        TaskMateという<br />
                        「システム倉庫」の鍵
                    </h2>
                    <p className="lead-text" style={{ maxWidth: '800px', margin: '20px auto', textAlign: 'center' }}>
                        TaskMateは、GAS（Google Apps Script）で開発された<br />
                        実務用システムの<strong>「使い放題ライブラリ」</strong>です。<br />
                        <br />
                        在庫管理、日報、給与計算、請求書発行...<br />
                        あらゆる業務システムを、我々がすでに開発し、<br />
                        <strong style={{ color: 'var(--force)' }}>300本以上</strong>ストックしています。<br /><br />
                        あなたがやることは、たった1つ。<br />
                        <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>「このシステムが欲しい」とLINEで送るだけ。</span>
                    </p>
                </div>

                <div className="grid-3 mt-6" style={{ maxWidth: '1100px', margin: '50px auto 0' }}>
                    <div className="glass-panel">
                        <div className="font-mono text-force" style={{ marginBottom: '15px' }}>// FEATURE_01</div>
                        <h4 style={{ marginBottom: '15px' }}>プロが作った「即戦力」システム</h4>
                        <p style={{ fontSize: '0.9rem', color: '#6e8274', lineHeight: 1.8 }}>
                            ChatGPTが作るコードは「動くかもしれない」レベル。<br />
                            TaskMateのシステムは<strong>「実務で使われている」</strong>レベル。<br /><br />
                            現役エンジニアが設計し、実際の企業で稼働しているシステムをテンプレート化。
                        </p>
                    </div>
                    <div className="glass-panel">
                        <div className="font-mono text-force" style={{ marginBottom: '15px' }}>// FEATURE_02</div>
                        <h4 style={{ marginBottom: '15px' }}>カタログから選ぶだけ</h4>
                        <p style={{ fontSize: '0.9rem', color: '#6e8274', lineHeight: 1.8 }}>
                            要件定義？　いりません。<br />
                            「こんな機能が欲しい」を伝える必要もありません。<br /><br />
                            カタログを見て、「これ欲しい」と送るだけ。<br />
                            <span style={{ color: 'var(--force)' }}>たったこれだけ。</span>
                        </p>
                    </div>
                    <div className="glass-panel">
                        <div className="font-mono text-force" style={{ marginBottom: '15px' }}>// FEATURE_03</div>
                        <h4 style={{ marginBottom: '15px' }}>カスタマイズもLINEで完結</h4>
                        <p style={{ fontSize: '0.9rem', color: '#6e8274', lineHeight: 1.8 }}>
                            「このシステムの、ここだけ変えたい」<br /><br />
                            TaskMateなら、LINEで伝えるだけで対応。<br />
                            追加料金？　かかりません。<br />
                            <strong>プランに含まれています。</strong>
                        </p>
                    </div>
                </div>

                <div className="compare-table" style={{ maxWidth: '900px', margin: '60px auto 40px' }}>
                    <div className="compare-card old">
                        <div className="compare-label">// TRADITIONAL</div>
                        <h4 style={{ marginBottom: '20px', color: '#6e8274' }}>従来の自動化</h4>
                        <ul className="step-list">
                            <li><span>要件定義</span><span>1週間</span></li>
                            <li><span>見積もり</span><span>3日</span></li>
                            <li><span>発注・契約</span><span>1週間</span></li>
                            <li><span>開発</span><span>1〜3ヶ月</span></li>
                            <li><span>テスト</span><span>2週間</span></li>
                            <li><span>修正</span><span>1週間</span></li>
                        </ul>
                        <div className="total-row">合計：2〜4ヶ月 / 50〜100万円</div>
                    </div>
                    <div className="compare-card new">
                        <div className="compare-label">// TASKMATE</div>
                        <h4 style={{ marginBottom: '20px', color: 'var(--force)' }}>TaskMateの自動化</h4>
                        <ul className="step-list">
                            <li><span>カタログを見る</span><span style={{ color: 'var(--force)' }}>1分</span></li>
                            <li><span>LINEで「これ欲しい」</span><span style={{ color: 'var(--force)' }}>10秒</span></li>
                            <li><span>ダウンロード</span><span style={{ color: 'var(--force)' }}>即日</span></li>
                            <li><span>使い始める</span><span style={{ color: 'var(--force)' }}>すぐ</span></li>
                        </ul>
                        <div className="total-row">合計：5分 / 月額1万円〜</div>
                    </div>
                </div>
            </div>
        </section>
    )
}
