'use client'
import React, { useState } from 'react'

const CatalogCategory = ({
    num,
    title,
    count,
    children
}: {
    num: string
    title: string
    count: string
    children: React.ReactNode
}) => {
    const [isOpen, setIsOpen] = useState(false) // Default collapsed

    return (
        <div className={`catalog-category ${!isOpen ? 'collapsed' : ''}`}>
            <div className="catalog-category-header" onClick={() => setIsOpen(!isOpen)}>
                <span className="catalog-category-num">{num}</span>
                <h3>{title}</h3>
                <span className="catalog-category-count">{count}</span>
            </div>
            <div className="catalog-grid">
                {children}
            </div>
        </div>
    )
}

export default function Catalog() {
    return (
        <section id="catalog" className="section-compact section-layer section-layer-white">
            <div className="marker tl">SEC.05 // SYSTEM_CATALOG</div>
            <h2 className="h-04" style={{ display: 'inline-block', textAlign: 'left' }}>
                <small>// READY_TO_USE_SYSTEMS</small>
                300以上のシステムから、<br />欲しいものを選ぶだけ
            </h2>
            <div style={{ textAlign: 'center', maxWidth: '900px', margin: '0 auto' }}>
                <p className="lead-text" style={{ margin: '30px auto', textAlign: 'center' }}>
                    現在<span className="text-force" style={{ fontWeight: 700, fontSize: '1.2em' }}>40</span>システム公開中。毎月追加で、300システム以上に拡大予定。<br />
                    「こんなシステムが欲しかった」が、きっと見つかります。
                </p>
            </div>

            {/* カテゴリ①：営業・顧客管理系 */}
            <CatalogCategory num="01" title="営業・顧客管理系" count="7 Systems">
                <div className="catalog-item">
                    <div className="catalog-item-num">01</div>
                    <h4>営業日報システム</h4>
                    <p>日報入力・週報月報自動生成。チーム全体の営業活動を可視化。Soft UIデザインでスマホ対応。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">02</div>
                    <h4>失客アラートシステム</h4>
                    <p>顧客の失客リスクを自動検知。「最近来てない」を自動で通知。対応漏れゼロに。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">03</div>
                    <h4>リピート促進メールシステム</h4>
                    <p>来店後フォローアップの自動化。「また来てください」を自動送信。リピート率向上に直結。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">04</div>
                    <h4>口コミ依頼自動化システム</h4>
                    <p>口コミ依頼の自動送信・管理。タイミングを逃さない。Googleマップの評価向上に。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">05</div>
                    <h4>顧客管理CRM</h4>
                    <p>顧客情報の一元管理。フォローアップの自動送信。購買履歴の分析。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">06</div>
                    <h4>LTV（顧客生涯価値）計算</h4>
                    <p>顧客ランク別管理。特典自動設定。VIP顧客の見える化。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">07</div>
                    <h4>離脱顧客掘り起こし</h4>
                    <p>休眠顧客を自動抽出。復帰キャンペーン自動送信。眠っていた売上を回復。</p>
                </div>
            </CatalogCategory>

            {/* カテゴリ②：管理・バックオフィス系 */}
            <CatalogCategory num="02" title="管理・バックオフィス系" count="6 Systems">
                <div className="catalog-item">
                    <div className="catalog-item-num">08</div>
                    <h4>経費精算ワークフロー</h4>
                    <p>経費申請・承認・精算の一元管理。紙の領収書からの解放。承認フローの自動化。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">09</div>
                    <h4>請求書自動生成＋送付</h4>
                    <p>BtoB向け請求書管理。顧客データから自動生成。PDF作成・メール送付まで自動化。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">10</div>
                    <h4>勤怠集計→給与計算連携</h4>
                    <p>勤怠打刻・残業管理。給与計算の自動化。月末の残業をゼロに。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">11</div>
                    <h4>契約更新リマインド</h4>
                    <p>契約期限の一元管理。更新通知の自動送信。更新漏れによる機会損失を防止。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">12</div>
                    <h4>承認フロー強制</h4>
                    <p>申請→承認→実行の流れを可視化。承認なしの実行を防止。内部統制の強化に。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">13</div>
                    <h4>入金消込チェッカー</h4>
                    <p>請求と入金の自動マッチング。消込作業の自動化。未入金の見える化。</p>
                </div>
            </CatalogCategory>

            {/* カテゴリ③：在庫・発注系 */}
            <CatalogCategory num="03" title="在庫・発注系" count="3 Systems">
                <div className="catalog-item">
                    <div className="catalog-item-num">14</div>
                    <h4>在庫アラートシステム</h4>
                    <p>在庫不足をSlack/メールで自動通知。発注点到達で即アラート。欠品リスクをゼロに。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">15</div>
                    <h4>期限管理システム</h4>
                    <p>届出期限の一元管理。アラート通知で期限切れ防止。免許・資格・契約すべて対応。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">16</div>
                    <h4>有効期限管理（資格・免許）</h4>
                    <p>資格・免許の期限を一元管理。自動通知でうっかり失効を防止。従業員全員分を一括管理。</p>
                </div>
            </CatalogCategory>

            {/* カテゴリ④：分析・レポート系 */}
            <CatalogCategory num="04" title="分析・レポート系" count="5 Systems">
                <div className="catalog-item">
                    <div className="catalog-item-num">17</div>
                    <h4>売上日報自動集計</h4>
                    <p>日次・週次・月次の売上レポート自動化。複数店舗のデータを自動統合。毎朝、何もしなくても数字が届く。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">18</div>
                    <h4>客単価分析＋アップセル提案</h4>
                    <p>購買データ分析。提案内容を自動生成。単価アップの施策に直結。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">19</div>
                    <h4>キャンペーン効果測定</h4>
                    <p>ROAS・ROI・CVを自動計算。どの施策が効いたか一目で分かる。次の施策の意思決定を高速化。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">20</div>
                    <h4>価格テストA/B管理</h4>
                    <p>価格A/Bテストの計画・実行・分析。どの価格が最適か、データで判断。感覚ではなく数字で経営。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">21</div>
                    <h4>紹介プログラム完全管理</h4>
                    <p>紹介キャンペーンの一元管理。効果測定まで自動化。紹介の連鎖を可視化。</p>
                </div>
            </CatalogCategory>

            {/* カテゴリ⑤：コミュニケーション・会議系 */}
            <CatalogCategory num="05" title="コミュニケーション・会議系" count="3 Systems">
                <div className="catalog-item">
                    <div className="catalog-item-num">22</div>
                    <h4>定例MTGアジェンダ自動収集</h4>
                    <p>議題収集・アジェンダ配信の自動化。「何話すんだっけ？」がなくなる。会議の生産性向上に。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">23</div>
                    <h4>議事録→タスク自動抽出</h4>
                    <p>議事録からTODOを自動抽出。リマインドまで自動化。「言った言わない」問題を解決。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">24</div>
                    <h4>ダブルブッキング防止（予約）</h4>
                    <p>Web予約＋重複防止の自動チェック。予約ミスをシステムで防止。顧客への謝罪をゼロに。</p>
                </div>
            </CatalogCategory>

            {/* カテゴリ⑥：その他ツール */}
            <CatalogCategory num="06" title="その他ツール" count="4 Systems">
                <div className="catalog-item">
                    <div className="catalog-item-num">25</div>
                    <h4>納期アラートシステム</h4>
                    <p>案件の納期を一元管理。アラート通知で遅延を防止。複数案件を同時に管理。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">40</div>
                    <h4>必須タスクチェックリスト</h4>
                    <p>テンプレートから漏れなくタスク管理。毎回同じ作業を標準化。新人教育にも活用可能。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">27</div>
                    <h4>価格表・見積基準管理</h4>
                    <p>価格マスタ＋見積作成。値引きルールの自動適用。見積作成時間を大幅短縮。</p>
                </div>
                <div className="catalog-item">
                    <div className="catalog-item-num">+</div>
                    <h4>Webアプリ開発マニュアル</h4>
                    <p>GAS開発の学習リソース・ドキュメント。自分でも学びたい人向け。</p>
                </div>
            </CatalogCategory>

            {/* 拡張予定 */}
            <div className="p-04-panel" data-status="EXPANDING" style={{ maxWidth: '800px', margin: '60px auto 0' }}>
                <div className="p-04-header">
                    <span className="p-04-label">// COMING_SOON</span>
                    <span className="p-04-status"></span>
                </div>
                <h4 style={{ marginBottom: '15px', color: 'var(--text-main)' }}>今後の追加予定</h4>
                <p style={{ fontSize: '0.9rem', color: '#6e8274', lineHeight: 1.8, marginBottom: '20px' }}>
                    採用管理システム / タスク管理ボード / シフト管理システム / 問い合わせ対応管理 / 社内Wiki自動更新 / データバックアップ自動化 / レビュー分析ダッシュボード / SNS投稿スケジューラー ...他多数
                </p>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                        <span style={{ color: '#6e8274' }}>現在</span>
                        <span style={{ color: 'var(--force)', fontSize: '1.5rem', fontWeight: 700, margin: '0 5px' }}>40</span>
                        <span style={{ color: '#6e8274' }}>→</span>
                        <span style={{ color: 'var(--force)', fontSize: '1.5rem', fontWeight: 700, margin: '0 5px' }}>300+</span>
                        <span style={{ color: '#6e8274' }}>システムに拡大予定</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--force)' }}>
                        「こんなシステムが欲しい」リクエストも受付中
                    </div>
                </div>
            </div>
        </section>
    )
}
