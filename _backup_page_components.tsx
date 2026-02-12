import React from 'react'
import ThreeBackground from '@/components/lp/ThreeBackground'
import FloatingCTA from '@/components/lp/FloatingCTA'
import Nav from '@/components/lp/Nav'
import Hero from '@/components/lp/Hero'
import Problem from '@/components/lp/Problem'
import Enemy from '@/components/lp/Enemy'
import Catalog from '@/components/lp/Catalog'
import AIGeneration from '@/components/lp/AIGeneration'
import Demo from '@/components/lp/Demo'
import Process from '@/components/lp/Process'
import Pricing from '@/components/lp/Pricing'
import Comparison from '@/components/lp/Comparison'
import RiskReversal from '@/components/lp/RiskReversal'
import Urgency from '@/components/lp/Urgency'
import Testimonials from '@/components/lp/Testimonials'
import FAQ from '@/components/lp/FAQ'
import Founder from '@/components/lp/Founder'
import Contact from '@/components/lp/Contact'
import Footer from '@/components/lp/Footer'
import '@/app/styles/lp.css'
import '@/app/styles/part3.css'

// Force update for deployment 2026-02-12 14:15
export default function Home() {
  return (
    <div className="lp-wrapper">
      <ThreeBackground />
      <Nav />

      <div className="main-content">
        <Hero />
        <Problem />
        <Enemy />
        <Catalog />
        <AIGeneration />
        <Demo />
        <Process />
        <Pricing />
        <Comparison />
        <RiskReversal />
        <Urgency />
        <Testimonials />
        <FAQ />
        <Founder />
        <Contact />
        <Footer />
      </div>

      <FloatingCTA />
    </div>
  )
}