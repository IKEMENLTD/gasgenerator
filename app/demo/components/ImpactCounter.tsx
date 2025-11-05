'use client'

import ClockIcon from './icons/ClockIcon'
import YenIcon from './icons/YenIcon'
import CheckIcon from './icons/CheckIcon'

interface ImpactCounterProps {
  timeSaved: number // 時間（月）
  costSaved: number // コスト（円/月）
  errorReduction: number // エラー削減率（%）
}

export default function ImpactCounter({ timeSaved, costSaved, errorReduction }: ImpactCounterProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
      <h3 className="font-bold text-lg mb-4 text-gray-900">削減効果</h3>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
            <ClockIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{timeSaved}時間</p>
            <p className="text-sm text-gray-600">月間削減時間</p>
            <p className="text-xs text-gray-400 mt-1">※手動作業5分/日 → 自動化</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <YenIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{costSaved.toLocaleString()}円</p>
            <p className="text-sm text-gray-600">月間コスト削減</p>
            <p className="text-xs text-gray-400 mt-1">※時給2,000円換算</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
            <CheckIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{errorReduction}%</p>
            <p className="text-sm text-gray-600">ミス削減率</p>
            <p className="text-xs text-gray-400 mt-1">※手入力ミスを自動化で解消</p>
          </div>
        </div>
      </div>
      <div className="mt-6 space-y-2">
        <a
          href="https://taskmateai.net/"
          className="block w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-lg text-center transition-colors"
        >
          無料で始める
        </a>
        <a
          href="https://timerex.net/s/cz1917903_47c5/7caf7949"
          className="block w-full bg-white hover:bg-gray-50 text-emerald-600 font-semibold py-3 px-4 rounded-lg text-center border-2 border-emerald-500 transition-colors"
        >
          無料相談を予約
        </a>
      </div>
    </div>
  )
}
