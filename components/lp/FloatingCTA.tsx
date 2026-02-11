'use client'

import React, { useEffect, useRef, useState } from 'react'

export default function FloatingCTA() {
    const [isVisible, setIsVisible] = useState(false)
    const ctaRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const heroSection = document.getElementById('hero')
        const contactSection = document.getElementById('contact')

        const updateFloatingCta = () => {
            const scrollY = window.scrollY
            const heroBottom = heroSection ? heroSection.offsetTop + heroSection.offsetHeight : 600
            const contactTop = contactSection ? contactSection.offsetTop - window.innerHeight : document.body.scrollHeight

            if (scrollY > heroBottom && scrollY < contactTop) {
                setIsVisible(true)
            } else {
                setIsVisible(false)
            }
        }

        window.addEventListener('scroll', updateFloatingCta)
        window.addEventListener('resize', updateFloatingCta)
        updateFloatingCta() // Initial check

        return () => {
            window.removeEventListener('scroll', updateFloatingCta)
            window.removeEventListener('resize', updateFloatingCta)
        }
    }, [])

    return (
        <div
            className={`floating-cta ${isVisible ? 'visible' : ''}`}
            id="floatingCta"
            ref={ctaRef}
        >
            <span className="cta-text">手作業に費やす時間を、今すぐ取り戻しませんか？</span>
            <a
                href="https://agency.ikemen.ltd/t/ky0zmcgdoqja"
                className="btn-floating"
                target="_blank"
                rel="noopener noreferrer"
            >
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}>
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
                LINEで無料相談
            </a>
            <a href="#pricing" className="btn-floating-outline" onClick={(e) => {
                e.preventDefault()
                document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
            }}>
                料金を見る
            </a>
        </div>
    )
}
