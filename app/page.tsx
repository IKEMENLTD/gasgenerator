'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function Home() {
  const pathname = usePathname()

  useEffect(() => {
    // Only redirect if on the root path exactly
    // This prevents /demo and other routes from being redirected
    if (pathname === '/') {
      window.location.href = '/index.html'
    }
  }, [pathname])

  return null
}