import type { Metadata } from 'next'
import './share-styles.css'

export const metadata: Metadata = {
  title: 'GAS Code Share',
  description: 'Google Apps Script Code Sharing Platform',
  icons: {
    icon: [
      { url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', type: 'image/svg+xml' },
    ],
  },
}

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
    </>
  )
}