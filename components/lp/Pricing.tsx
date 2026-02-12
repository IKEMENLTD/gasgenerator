import React from 'react'

export default function Pricing() {
    return (
        <section id="pricing" className="section-compact section-layer section-layer-white">
            <div className="marker tr">SEC.09 // PRICING</div>
            <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                <div className="jp-sub">料金プラン</div>
                <h2 className="section-header" style={{ display: 'block', textAlign: 'center' }}>
                    シンプルで透明な料金体系
                </h2>
                <p className="lead-text" style={{ margin: '20px auto', textAlign: 'center' }}>
                    初期費用0円・解約金0円・追加料金なし。動作不良時返金保証付き
                </p>
            </div>

            <div className="grid-4 mt-6">
                <div className="pricing-card">
                    <div className="plan-name">お試し</div>
                    <div className="price">無料</div>
                    <ul className="features">
                        <li>1か月10回まで自動コーディング無料</li>
                        <li>GASコード自動生成</li>
                        <li>基本的なサポート</li>
                        <li>LINE連携対応</li>
                    </ul>
                    <a href="#" className="btn-core">無料利用開始</a>
                </div>
                <div className="pricing-card featured">
                    <div className="recommend-ribbon"></div>
                    <div className="plan-badge">人気No.1</div>
                    <div className="plan-name">ビジネスプラン</div>
                    <div className="price">¥10,000<span>/月</span></div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--force)', marginTop: '5px' }}>2か月に1システムDL可能</p>
                    <ul className="features">
                        <li>カタログから選んでDL</li>
                        <li>現役エンジニアのチャットサポート</li>
                        <li>操作マニュアル付き</li>
                        <li>LINE即時サポート</li>
                        <li>動作不良時返金保証</li>
                    </ul>
                    <a href="#" className="btn-core btn-primary">このプランで始める</a>
                </div>
                <div className="pricing-card">
                    <div className="plan-name">プロフェッショナル</div>
                    <div className="price">¥50,000<span>/月</span></div>
                    <p style={{ fontSize: '0.8rem', color: '#6e8274', marginTop: '5px' }}>毎月3システムDL + 代行付き</p>
                    <ul className="features">
                        <li>毎月3つまでシステムDL</li>
                        <li>コーディング代行付き</li>
                        <li>設置代行も対応可能</li>
                        <li>カスタム開発は納期見積もり</li>
                        <li>優先サポート対応</li>
                    </ul>
                    <p style={{ fontSize: '0.75rem', color: 'var(--force)', marginTop: '10px', padding: '8px 12px', background: 'rgba(45, 143, 94, 0.05)', borderRadius: '4px' }}>
                        <strong>急ぎオプション：</strong>+¥50,000で納期半分
                    </p>
                    <a href="#" className="btn-core">詳細を確認</a>
                </div>
                <div className="pricing-card">
                    <div className="plan-name">エンタープライズ</div>
                    <div className="price">個別見積</div>
                    <ul className="features">
                        <li>フルカスタマイズ開発</li>
                        <li>専用開発チーム</li>
                        <li>現役エンジニアのチャットサポート</li>
                        <li>SLA保証</li>
                        <li>オンサイト対応</li>
                        <li>24時間緊急対応</li>
                    </ul>
                    <a href="#contact" className="btn-core">お問い合わせ</a>
                </div>
            </div>
        </section>
    )
}
