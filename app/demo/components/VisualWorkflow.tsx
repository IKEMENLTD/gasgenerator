'use client'

import ChatBubbleIcon from './icons/ChatBubbleIcon'
import RobotIcon from './icons/RobotIcon'
import LightningIcon from './icons/LightningIcon'
import ClipboardIcon from './icons/ClipboardIcon'
import PartyIcon from './icons/PartyIcon'
import SparklesIcon from './icons/SparklesIcon'
import { ReactNode } from 'react'

interface WorkflowStep {
  number: number
  icon: ReactNode
  title: string
  description: string
  color: string
}

export default function VisualWorkflow() {
  const steps: WorkflowStep[] = [
    {
      number: 1,
      icon: <ChatBubbleIcon className="w-7 h-7 text-white" />,
      title: 'LINEで相談',
      description: '「○○を自動化したい」と日本語で送信',
      color: 'from-blue-500 to-blue-600'
    },
    {
      number: 2,
      icon: <RobotIcon className="w-7 h-7 text-white" />,
      title: 'AI が理解',
      description: 'TaskMateが要件を分析・最適化',
      color: 'from-purple-500 to-purple-600'
    },
    {
      number: 3,
      icon: <LightningIcon className="w-7 h-7 text-white" />,
      title: 'コード生成',
      description: 'GASコードを自動生成（数分）',
      color: 'from-emerald-500 to-emerald-600'
    },
    {
      number: 4,
      icon: <ClipboardIcon className="w-7 h-7 text-white" />,
      title: 'コピペ',
      description: 'Apps Scriptエディタに貼り付け',
      color: 'from-orange-500 to-orange-600'
    },
    {
      number: 5,
      icon: <PartyIcon className="w-7 h-7 text-white" />,
      title: '完成！',
      description: '業務が自動化され時間を削減',
      color: 'from-pink-500 to-pink-600'
    }
  ]

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-6 mb-6">
      <h3 className="font-bold text-lg mb-6 text-gray-900 text-center">
        簡単3ステップで自動化
      </h3>

      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.number} className="relative">
            {/* Connecting Line */}
            {index < steps.length - 1 && (
              <div className="absolute left-6 top-14 w-0.5 h-8 bg-gray-300 z-0"></div>
            )}

            {/* Step Card */}
            <div className="relative bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                {/* Step Number Circle */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
                  {step.icon}
                </div>

                {/* Step Content */}
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-500">STEP {step.number}</span>
                    <h4 className="font-bold text-gray-900">{step.title}</h4>
                  </div>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold mb-1">プログラミング知識不要</p>
            <p className="text-sm text-emerald-100">初回5分で設定完了、以降は完全自動</p>
          </div>
          <SparklesIcon className="w-10 h-10 text-white" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="bg-white rounded-lg p-3 text-center border border-gray-200">
          <div className="text-xl font-bold text-emerald-600">5分</div>
          <div className="text-xs text-gray-600">初回設定</div>
        </div>
        <div className="bg-white rounded-lg p-3 text-center border border-gray-200">
          <div className="text-xl font-bold text-emerald-600">0円</div>
          <div className="text-xs text-gray-600">初期費用</div>
        </div>
        <div className="bg-white rounded-lg p-3 text-center border border-gray-200">
          <div className="text-xl font-bold text-emerald-600">無制限</div>
          <div className="text-xs text-gray-600">修正回数</div>
        </div>
      </div>
    </div>
  )
}
