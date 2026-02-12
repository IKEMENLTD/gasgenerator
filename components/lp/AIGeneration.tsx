import React from 'react'

export default function AIGeneration() {
    return (
        <div className="dark-section-wrapper">
            <section id="ai-gen" className="section-compact" style={{ background: 'linear-gradient(135deg, #0d0d0d 0%, #0a1a10 100%)', position: 'relative' }}>
                <div className="marker tl" style={{ color: '#6e8274' }}>SEC.06 // AI_GENERATION</div>
                <div className="split-layout" style={{ paddingTop: '30px' }}>
                    <div>
                        <span className="badge" style={{ background: 'var(--force)', marginBottom: '20px' }}>NEW</span>
                        <div className="jp-sub" style={{ marginTop: '10px' }}>AIがGASコード生成をサポート</div>
                        <h2 className="section-header">
                            LINE×AIで<br />GASコードを簡単作成
                        </h2>
                        <p style={{ color: '#9aaea0', lineHeight: 1.9, marginTop: '30px' }}>
                            「Google Apps Scriptで自動化したいけどプログラミングが難しい...」<br />
                            そんなあなたに、AIがLINE経由で最適なコードを生成します
                        </p>

                        <div style={{ marginTop: '40px' }}>
                            <div style={{ marginBottom: '25px' }}>
                                <h4 style={{ color: 'var(--force)', fontSize: '1rem', marginBottom: '8px' }}>日本語でコード生成依頼</h4>
                                <p style={{ color: '#8a9f90', fontSize: '0.9rem' }}>「スプレッドシートの売上データを毎朝9時に集計するコードが欲しい」と伝えるだけで、AIが完全なGASコードを生成</p>
                            </div>
                            <div style={{ marginBottom: '25px' }}>
                                <h4 style={{ color: 'var(--force)', fontSize: '1rem', marginBottom: '8px' }}>エラー解決もAIがサポート</h4>
                                <p style={{ color: '#8a9f90', fontSize: '0.9rem' }}>「コードが動かない」「エラーが出た」という時も、エラー内容を送るだけでAIが修正方法を教えてくれます</p>
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--force)', fontSize: '1rem', marginBottom: '8px' }}>学習しながら使える</h4>
                                <p style={{ color: '#8a9f90', fontSize: '0.9rem' }}>AIが生成したコードには詳しい解説付き。少しずつGASの知識を身につけながら、自分でカスタマイズも可能に</p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div style={{ background: '#0f1f15', border: '1px solid #1a2a20', padding: '30px', borderRadius: '8px' }}>
                            <div className="font-mono" style={{ color: 'var(--force)', fontSize: '0.8rem', marginBottom: '20px' }}>// こんなGASコードが作れます</div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                <li style={{ color: '#c5d4ca', padding: '12px 0', borderBottom: '1px solid #1a2a20', fontSize: '0.95rem' }}>スプレッドシートのデータを自動集計</li>
                                <li style={{ color: '#c5d4ca', padding: '12px 0', borderBottom: '1px solid #1a2a20', fontSize: '0.95rem' }}>特定条件でメール自動送信</li>
                                <li style={{ color: '#c5d4ca', padding: '12px 0', borderBottom: '1px solid #1a2a20', fontSize: '0.95rem' }}>カレンダー予定の自動登録</li>
                                <li style={{ color: '#c5d4ca', padding: '12px 0', borderBottom: '1px solid #1a2a20', fontSize: '0.95rem' }}>フォーム回答の自動処理</li>
                                <li style={{ color: '#c5d4ca', padding: '12px 0', fontSize: '0.95rem' }}>データのグラフ化・レポート作成</li>
                            </ul>
                            <a href="https://agency.ikemen.ltd/t/ky0zmcgdoqja" className="btn-core btn-line" style={{ marginTop: '30px' }}>
                                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" /></svg>
                                今すぐLINEで試す
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
