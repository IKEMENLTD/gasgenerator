import React from 'react'

export default function Comparison() {
    return (
        <section id="comparison" className="section-compact section-layer section-layer-subtle">
            <div className="marker tl">SEC.10 // COMPARISON</div>
            <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                <div className="jp-sub">プラン詳細比較</div>
                <h2 className="section-header" style={{ display: 'block', textAlign: 'center' }}>
                    あなたに最適なプランを選択
                </h2>
                <p className="lead-text" style={{ margin: '20px auto', textAlign: 'center' }}>
                    自分で設置するなら1万円、代行も欲しいなら5万円。<br />
                    どちらも現役エンジニアによる徹底サポート付き
                </p>
            </div>

            <div className="comparison-grid mt-6">
                <div className="comparison-card">
                    <div className="card-header">
                        <div className="plan-type">セルフ導入プラン</div>
                        <div className="plan-name">ビジネスプラン</div>
                        <div className="price">¥10,000<span>/月</span></div>
                        <p style={{ fontSize: '0.85rem', color: '#6e8274', marginTop: '10px' }}>2か月に1システムをダウンロード</p>
                    </div>
                    <h5>主な機能</h5>
                    <ul>
                        <li>カタログから好きなシステムを選択</li>
                        <li>2か月に1つダウンロード可能</li>
                        <li>現役エンジニアのチャットサポート</li>
                        <li>操作マニュアル付き</li>
                        <li>エラー解決サポート無制限</li>
                    </ul>
                    <h5>こんな方におすすめ</h5>
                    <ul>
                        <li>自分で設置・運用できる</li>
                        <li>コストを抑えて始めたい</li>
                        <li>まずは1つ試してみたい</li>
                    </ul>
                    <p style={{ fontSize: '0.8rem', color: '#6e8274', marginTop: '20px' }}>※6ヶ月契約（最低利用期間）</p>
                </div>
                <div className="comparison-card highlight">
                    <div className="card-header">
                        <div className="plan-type">フルサポートプラン</div>
                        <div className="plan-name">プロフェッショナルプラン</div>
                        <div className="price">¥50,000<span>/月</span></div>
                        <p style={{ fontSize: '0.85rem', color: '#6e8274', marginTop: '10px' }}>毎月3システムDL + 代行サービス付き</p>
                    </div>
                    <h5>主な機能</h5>
                    <ul>
                        <li>毎月3つまでシステムDL可能</li>
                        <li>コーディング代行付き</li>
                        <li>設置代行も対応可能</li>
                        <li>カスタム開発は納期で見積もり</li>
                        <li>優先サポート対応</li>
                    </ul>
                    <h5>急ぎオプション</h5>
                    <ul>
                        <li><strong style={{ color: 'var(--force)' }}>+¥50,000で納期半分に短縮</strong></li>
                        <li>急ぎの案件も対応可能</li>
                    </ul>
                    <h5>こんな方におすすめ</h5>
                    <ul>
                        <li>設置も全部任せたい</li>
                        <li>カスタム開発もしたい</li>
                        <li>複数システムを導入したい</li>
                    </ul>
                    <p style={{ fontSize: '0.8rem', color: '#6e8274', marginTop: '20px' }}>※6ヶ月契約（最低利用期間）</p>
                </div>
            </div>
        </section>
    )
}
