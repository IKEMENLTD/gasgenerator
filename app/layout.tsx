import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GAS自動生成システム',
  description: 'LINEから自然言語でGoogle Apps Scriptを自動生成',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}