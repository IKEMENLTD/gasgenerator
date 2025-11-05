'use client'

interface Step {
  id: number
  label: string
  completed: boolean
}

interface ProgressBarProps {
  currentStep: number
  totalSteps: number
  steps: Step[]
}

export default function ProgressBar({ currentStep, totalSteps, steps }: ProgressBarProps) {
  const progress = (currentStep / totalSteps) * 100

  return (
    <div className="w-full bg-white rounded-lg shadow-sm p-4 mb-6 sticky top-0 z-10">
      {/* Progress Percentage */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">
          デモ進捗
        </span>
        <span className="text-sm font-bold text-emerald-600">
          {Math.round(progress)}% 完了
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
        </div>
      </div>

      {/* Steps */}
      <div className="flex justify-between items-center">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className="flex flex-col items-center flex-1"
          >
            {/* Step Circle */}
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                transition-all duration-300
                ${step.completed
                  ? 'bg-emerald-500 text-white'
                  : step.id === currentStep
                  ? 'bg-emerald-100 text-emerald-600 ring-2 ring-emerald-500'
                  : 'bg-gray-200 text-gray-400'
                }
              `}
            >
              {step.completed ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.id
              )}
            </div>

            {/* Step Label */}
            <span
              className={`
                text-xs mt-1 text-center hidden sm:block
                ${step.completed || step.id === currentStep
                  ? 'text-gray-700 font-medium'
                  : 'text-gray-400'
                }
              `}
            >
              {step.label}
            </span>

            {/* Connecting Line */}
            {index < steps.length - 1 && (
              <div
                className={`
                  absolute h-0.5 -z-10 transition-all duration-300
                  ${step.completed ? 'bg-emerald-500' : 'bg-gray-200'}
                `}
                style={{
                  width: `calc(${100 / steps.length}% - 2rem)`,
                  left: `calc(${(index * 100) / steps.length}% + 1rem)`,
                  top: '1rem'
                }}
              ></div>
            )}
          </div>
        ))}
      </div>

      {/* Encouragement Message */}
      {currentStep < totalSteps && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            {currentStep === 1 && '👋 ようこそ！シナリオを選択してください'}
            {currentStep === 2 && '🎯 素晴らしい！詳細を確認しています...'}
            {currentStep === 3 && '⚡ コードを生成中...少々お待ちください'}
            {currentStep === 4 && '📋 あと少しでセットアップガイドが完成します！'}
            {currentStep === 5 && '🎉 もうすぐ完了です！無料相談で次のステップへ'}
          </p>
        </div>
      )}

      {currentStep === totalSteps && (
        <div className="mt-4 text-center">
          <p className="text-sm font-semibold text-emerald-600">
            🎊 デモ完了！実際に使ってみませんか？
          </p>
        </div>
      )}
    </div>
  )
}
