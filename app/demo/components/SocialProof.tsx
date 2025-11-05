'use client'

interface Testimonial {
  name: string
  company: string
  role: string
  comment: string
  avatar: string
}

interface Stat {
  value: string
  label: string
}

export default function SocialProof() {
  const stats: Stat[] = [
    { value: '120+', label: '導入企業数' },
    { value: '500+', label: '生成スクリプト数' },
    { value: '10,000+', label: '削減時間（月）' }
  ]

  const testimonials: Testimonial[] = [
    {
      name: '田中 太郎',
      company: '株式会社ABC商事',
      role: '営業部長',
      comment: '月40時間かかっていた売上集計が、わずか5分に。営業活動に集中できるようになりました。',
      avatar: '👨‍💼'
    },
    {
      name: '佐藤 花子',
      company: '合同会社XYZ物流',
      role: '経理担当',
      comment: 'プログラミング知識ゼロでしたが、LINEで指示するだけで在庫管理が自動化できました。',
      avatar: '👩‍💼'
    },
    {
      name: '鈴木 一郎',
      company: '株式会社DEF製造',
      role: 'IT担当',
      comment: '週次レポート作成が完全自動化。金曜の残業がなくなり、チーム全体の生産性が向上しました。',
      avatar: '👨‍💻'
    }
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h3 className="font-bold text-lg mb-4 text-gray-900">導入実績</h3>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map((stat, index) => (
          <div key={index} className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{stat.value}</div>
            <div className="text-xs text-gray-600 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Testimonials */}
      <div className="space-y-4">
        <h4 className="font-semibold text-sm text-gray-700 mb-3">お客様の声</h4>
        {testimonials.map((testimonial, index) => (
          <div key={index} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-2">
              <div className="text-2xl">{testimonial.avatar}</div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-gray-900">{testimonial.name}</div>
                <div className="text-xs text-gray-600">
                  {testimonial.company} / {testimonial.role}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {testimonial.comment}
            </p>
          </div>
        ))}
      </div>

      {/* Trust Badges */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <span className="text-emerald-500">✓</span>
            <span>セキュア</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-emerald-500">✓</span>
            <span>14日間返金保証</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-emerald-500">✓</span>
            <span>無料サポート</span>
          </div>
        </div>
      </div>
    </div>
  )
}
