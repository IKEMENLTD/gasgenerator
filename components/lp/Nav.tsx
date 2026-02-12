import React from 'react'

export default function Nav() {
    return (
        <nav className="lp-nav">
            <a href="#" className="nav-logo">
                <div className="logo-mark">
                    {/* Ensure images are placed in public/images/lp/ */}
                    <img src="/images/lp/logo.png" alt="TaskMate" />
                </div>
                TaskMate
            </a>
            <div className="nav-menu">
                <a href="#features">機能</a>
                <a href="#process">導入の流れ</a>
                <a href="#pricing">料金</a>
                <a href="#testimonials">導入事例</a>
                <a href="#faq">FAQ</a>
                <a href="https://agency.ikemen.ltd/" target="_blank" rel="noopener noreferrer" className="nav-agency">
                    <span className="nav-agency-text">
                        <svg className="nav-agency-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        代理店様はこちら
                    </span>
                </a>
                <a href="#contact" className="nav-cta">無料相談</a>
            </div>
        </nav>
    )
}
