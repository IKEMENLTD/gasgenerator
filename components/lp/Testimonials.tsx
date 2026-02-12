import React from 'react'

export default function Testimonials() {
    return (
        <section id="testimonials" className="section-compact section-layer section-layer-off">
            <div className="marker tr">SEC.11 // TESTIMONIALS</div>
            <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                <div className="jp-sub">導入事例</div>
                <h2 className="section-header" style={{ display: 'block', textAlign: 'center' }}>
                    導入企業様からの声
                </h2>
                <p className="lead-text" style={{ margin: '20px auto', textAlign: 'center' }}>
                    150社以上の企業様にご利用いただき、高い評価をいただいています
                </p>
            </div>

            <div className="testimonial-marquee">
                <div className="testimonial-track">
                    {/* Original cards */}
                    <div className="testimonial-card">
                        <p className="quote">
                            在庫管理の自動化により、月40時間以上の削減に成功しました。発注ミスもゼロになり、欠品による機会損失もなくなりました。投資は2ヶ月で回収できました。
                        </p>
                        <div className="author">
                            <div className="author-avatar"><img src="/images/lp/takahashiyuuto.png" alt="高橋悠人" /></div>
                            <div className="author-info">
                                <div className="name">高橋悠人 様</div>
                                <div className="role">株式会社ネオビジョンテックス 代表取締役</div>
                            </div>
                        </div>
                    </div>
                    <div className="testimonial-card">
                        <p className="quote">
                            5店舗の売上データが毎朝自動で届くようになり、経営判断のスピードが格段に上がりました。データ分析の時間も取れるようになり、売上も15%向上しました。
                        </p>
                        <div className="author">
                            <div className="author-avatar"><img src="/images/lp/mizuno.png" alt="水野" /></div>
                            <div className="author-info">
                                <div className="name">水野 様</div>
                                <div className="role">グローバルヴォーグ株式会社 代表取締役</div>
                            </div>
                        </div>
                    </div>
                    <div className="testimonial-card">
                        <p className="quote">
                            勤怠管理と給与計算の自動化で、月末の残業がなくなりました。ミスもゼロになり、従業員からの問い合わせも激減。本来の人事業務に集中できています。
                        </p>
                        <div className="author">
                            <div className="author-avatar"><img src="/images/lp/akabaneyui.png" alt="赤羽根由唯" /></div>
                            <div className="author-info">
                                <div className="name">赤羽根由唯 様</div>
                                <div className="role">オプティカル通信株式会社 代表取締役</div>
                            </div>
                        </div>
                    </div>
                    <div className="testimonial-card">
                        <p className="quote">
                            LINEから簡単に指示できるのが本当に便利です。プログラミングの知識がなくても、AIが最適なGASコードを生成してくれるので、業務改善のアイデアがすぐに形になります。導入後、チーム全体の生産性が30%向上しました。
                        </p>
                        <div className="author">
                            <div className="author-avatar"><img src="/images/lp/koikehiroto.png" alt="小池寛人" /></div>
                            <div className="author-info">
                                <div className="name">小池寛人 様</div>
                                <div className="role">株式会社リバイバル 代表取締役</div>
                            </div>
                        </div>
                    </div>

                    {/* Duplicated cards for seamless loop */}
                    <div className="testimonial-card">
                        <p className="quote">
                            在庫管理の自動化により、月40時間以上の削減に成功しました。発注ミスもゼロになり、欠品による機会損失もなくなりました。投資は2ヶ月で回収できました。
                        </p>
                        <div className="author">
                            <div className="author-avatar"><img src="images/takahashiyuuto.png" alt="高橋悠人" /></div>
                            <div className="author-info">
                                <div className="name">高橋悠人 様</div>
                                <div className="role">株式会社ネオビジョンテックス 代表取締役</div>
                            </div>
                        </div>
                    </div>
                    <div className="testimonial-card">
                        <p className="quote">
                            5店舗の売上データが毎朝自動で届くようになり、経営判断のスピードが格段に上がりました。データ分析の時間も取れるようになり、売上も15%向上しました。
                        </p>
                        <div className="author">
                            <div className="author-avatar"><img src="images/mizuno.png" alt="水野" /></div>
                            <div className="author-info">
                                <div className="name">水野 様</div>
                                <div className="role">グローバルヴォーグ株式会社 代表取締役</div>
                            </div>
                        </div>
                    </div>
                    <div className="testimonial-card">
                        <p className="quote">
                            勤怠管理と給与計算の自動化で、月末の残業がなくなりました。ミスもゼロになり、従業員からの問い合わせも激減。本来の人事業務に集中できています。
                        </p>
                        <div className="author">
                            <div className="author-avatar"><img src="images/akabaneyui.png" alt="赤羽根由唯" /></div>
                            <div className="author-info">
                                <div className="name">赤羽根由唯 様</div>
                                <div className="role">オプティカル通信株式会社 代表取締役</div>
                            </div>
                        </div>
                    </div>
                    <div className="testimonial-card">
                        <p className="quote">
                            LINEから簡単に指示できるのが本当に便利です。プログラミングの知識がなくても、AIが最適なGASコードを生成してくれるので、業務改善のアイデアがすぐに形になります。導入後、チーム全体の生産性が30%向上しました。
                        </p>
                        <div className="author">
                            <div className="author-avatar"><img src="/images/lp/koikehiroto.png" alt="小池寛人" /></div>
                            <div className="author-info">
                                <div className="name">小池寛人 様</div>
                                <div className="role">株式会社リバイバル 代表取締役</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
