import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GAS自動生成システム',
  description: 'LINEから自然言語でGoogle Apps Scriptを自動生成',
  icons: {
    icon: [
      { url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', type: 'image/svg+xml' },
    ],
  },
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