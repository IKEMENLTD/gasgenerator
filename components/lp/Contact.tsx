import React from 'react'

export default function Contact() {
    return (
        <section id="contact" className="section-compact cta-section">
            <div className="marker bl" style={{ color: '#6e8274' }}>SEC.13 // CONTACT</div>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <h2 className="section-header" style={{ display: 'block', textAlign: 'center' }}>
                    今すぐ業務効率化を始めよう
                </h2>
                <p style={{ margin: '20px 0 40px', textAlign: 'center', color: 'var(--text-mute)' }}>
                    動作不良時は返金保証付き。安心して始められます
                </p>

                <div style={{ textAlign: 'center' }}>
                    <a href="https://agency.ikemen.ltd/t/ky0zmcgdoqja" className="btn-core btn-line" style={{ padding: '18px 50px', fontSize: '1rem' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" /></svg>
                        LINEで無料相談する
                    </a>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-mute)', marginTop: '20px' }}>
                        営業電話は一切いたしません
                    </p>
                </div>
            </div>
        </section>
    )
}
