import React from 'react'

export default function FAQ() {
    return (
        <section id="faq" className="section-compact section-layer section-layer-muted">
            <div className="marker tl">SEC.12 // FAQ</div>
            <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                <div className="jp-sub">よくあるご質問</div>
                <h2 className="section-header" style={{ display: 'block', textAlign: 'center' }}>
                    FAQ
                </h2>
            </div>

            <div style={{ maxWidth: '900px', margin: '60px auto 0' }}>
                <details className="faq-item">
                    <summary>契約期間の縛りはありますか？</summary>
                    <div className="answer">
                        6ヶ月の最低契約期間があります。月額料金でのお支払いとなり、6ヶ月経過後はいつでも解約可能です。また、動作不良時の返金保証もありますので、安心してお試しいただけます。
                    </div>
                </details>
                <details className="faq-item">
                    <summary>支払い方法は何がありますか？</summary>
                    <div className="answer">
                        銀行振込、クレジットカード（VISA/Master/JCB/AMEX）、請求書払い（法人のみ）に対応しています。お支払いは月払い・年払いから選択可能で、年払いの場合は10%割引となります。
                    </div>
                </details>
                <details className="faq-item">
                    <summary>セキュリティは大丈夫ですか？</summary>
                    <div className="answer">
                        はい、安心してご利用いただけます。データは全てGoogle Workspace内で処理され、外部サーバーには保存されません。全ての通信はSSL暗号化され、定期的なセキュリティ監査を実施しています。
                    </div>
                </details>
                <details className="faq-item">
                    <summary>既存のシステムと連携できますか？</summary>
                    <div className="answer">
                        はい、可能です。API連携により、会計ソフト、CRM、在庫管理システムなど、様々な既存システムとの連携実績があります。詳細は無料診断時にご相談ください。
                    </div>
                </details>
                <details className="faq-item">
                    <summary>プログラミングの知識がなくても本当に使えますか？</summary>
                    <div className="answer">
                        はい、全く問題ありません。LINEで日本語で「〇〇を自動化したい」と伝えるだけで、AIが最適なGASコードを生成します。コードの設置や実行方法も、わかりやすい動画マニュアルと個別サポートでご案内しますので、どなたでも簡単にご利用いただけます。
                    </div>
                </details>
                <details className="faq-item">
                    <summary>どのような業務を自動化できますか？</summary>
                    <div className="answer">
                        スプレッドシートを使った業務であれば、ほぼすべて自動化可能です。売上集計、在庫管理、勤怠管理、請求書作成、データ分析、レポート作成など、定期的に行う作業や、ルールに基づいた処理は特に効果的です。無料診断で貴社の業務に合わせた具体的な提案をさせていただきます。
                    </div>
                </details>
                <details className="faq-item">
                    <summary>導入後のサポート体制はどうなっていますか？</summary>
                    <div className="answer">
                        LINEによる即時サポート（平均返信時間5分以内）をご提供しています。操作方法の質問、エラーの解決、新しい自動化の相談など、どんなことでもお気軽にご相談ください。また、月1回の定期レビューで、より効果的な活用方法もご提案します。
                    </div>
                </details>
                <details className="faq-item">
                    <summary>初期費用はかかりますか？</summary>
                    <div className="answer">
                        いいえ、初期費用は一切かかりません。月額料金のみで、すべてのサービスをご利用いただけます。また、動作不良時は返金保証がありますので、安心してお試しいただけます。
                    </div>
                </details>
                <details className="faq-item">
                    <summary>自社のデータは安全に管理されますか？</summary>
                    <div className="answer">
                        はい、お客様のデータは厳重に保護されています。すべての処理はGoogle Workspace内で完結し、外部サーバーにデータを保存することはありません。また、アクセス権限の管理も細かく設定できるため、必要な人だけがデータにアクセスできるようコントロール可能です。
                    </div>
                </details>
                <details className="faq-item">
                    <summary>他社の自動化ツールとの違いは何ですか？</summary>
                    <div className="answer">
                        最大の違いは、AIによるコード生成機能です。他社ツールでは決められた機能しか使えませんが、TaskMateではAIが貴社の業務に合わせて最適なコードを生成するため、完全なカスタマイズが可能です。また、LINEで簡単に操作できる点も大きな特徴です。
                    </div>
                </details>
            </div>
        </section>
    )
}
