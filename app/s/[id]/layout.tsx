import type { Metadata } from 'next'
import './share-styles.css'

export const metadata: Metadata = {
  title: 'GAS Code Share',
  description: 'Google Apps Script Code Sharing Platform',
}

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons@latest/iconfont/tabler-icons.min.css"
      />
      {children}
    </>
  )
}