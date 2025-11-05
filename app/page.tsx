'use client'

import { useEffect } from 'react'

export default function Home() {
  useEffect(() => {
    // Redirect to index.html in public folder
    window.location.href = '/index.html'
  }, [])

  return null
}