'use client'

import { ReactNode } from 'react'

interface ScenarioButtonProps {
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
}

export default function ScenarioButton({ icon, title, description, onClick }: ScenarioButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-200 group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </button>
  )
}
