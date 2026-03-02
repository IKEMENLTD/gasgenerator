'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Header from '@/components/lp/Header'
import Footer from '@/components/lp/Footer'
import Pricing from '@/components/lp/Pricing'
import Comparison from '@/components/lp/Comparison'
import RiskReversal from '@/components/lp/RiskReversal'
import FAQ from '@/components/lp/FAQ'
import '@/app/styles/lp.css'

function PricingContent() {
  const searchParams = useSearchParams()
  const userId = searchParams.get('user_id') || ''
  const plan = searchParams.get('plan') || ''

  useEffect(() => {
    if (plan) {
      const pricingSection = document.getElementById('pricing')
      if (pricingSection) {
        pricingSection.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [plan])

  return (
    <div className="lp-wrapper">
      <Header />
      <div className="main-content" style={{ paddingTop: '100px' }}>
        <Pricing />
        <Comparison />
        <RiskReversal />
        <FAQ />
      </div>
      <Footer />
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>読み込み中...</p>
    </div>}>
      <PricingContent />
    </Suspense>
  )
}
