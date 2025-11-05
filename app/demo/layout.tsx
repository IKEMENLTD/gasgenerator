import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'TaskMate デモ体験 | プログラミング不要のGAS自動生成',
  description: 'LINEで日本語指示を送るだけでGoogle Apps Scriptを自動生成。業務自動化をすぐに体験できるデモサイト。月額1万円から。',
  openGraph: {
    title: 'TaskMate デモ体験 | プログラミング不要のGAS自動生成',
    description: 'LINEで日本語指示を送るだけでGoogle Apps Scriptを自動生成。業務自動化をすぐに体験。',
    type: 'website',
  },
}

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
