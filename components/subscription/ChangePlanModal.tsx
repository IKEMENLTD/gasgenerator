'use client'

import { useState } from 'react'
import { PLAN_CONFIG, PlanId, formatCurrencyJP } from '@/lib/subscription-utils'

interface ChangePlanModalProps {
    isOpen: boolean
    onClose: () => void
    currentPlanId: string
    userId: string
}

export function ChangePlanModal({ isOpen, onClose, currentPlanId, userId }: ChangePlanModalProps) {
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
    const [step, setStep] = useState<'select' | 'confirm' | 'processing'>('select')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!isOpen) return null

    // 現在のプラン以外のプランリストを作成
    const availablePlans = Object.values(PLAN_CONFIG).filter(p => p.id !== currentPlanId)

    const handleSelectPlan = (planId: string) => {
        setSelectedPlanId(planId)
        setStep('confirm')
        setError(null)
    }

    const handleBack = () => {
        setStep('select')
        setError(null)
    }

    const handleSubmit = async () => {
        if (!selectedPlanId) return

        setLoading(true)
        setError(null)
        setStep('processing')

        try {
            const res = await fetch('/api/subscription/change-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    newPlanId: selectedPlanId
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'プラン変更に失敗しました')
            }

            if (data.requiresPayment && data.checkoutUrl) {
                // 支払いが必要なためStripeへリダイレクト
                window.location.href = data.checkoutUrl
            } else {
                // 支払い不要（即時変更）
                alert('プラン変更が完了しました！')
                onClose()
                window.location.reload()
            }

        } catch (e: any) {
            console.error('Plan change error:', e)
            setError(e.message)
            setStep('select') // エラー時は選択画面に戻る
        } finally {
            setLoading(false)
        }
    }

    const targetPlan = selectedPlanId ? Object.values(PLAN_CONFIG).find(p => p.id === selectedPlanId) : null
    const currentPlanConfig = Object.values(PLAN_CONFIG).find(p => p.id === currentPlanId)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200" style={{ maxHeight: '90vh', overflowY: 'auto' }}>

                {/* Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                    <h3 className="font-bold text-gray-900">プラン変更</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {step === 'select' && (
                        <div className="space-y-6">
                            <p className="text-gray-600 text-center mb-4">
                                変更先のプランを選択してください。<br />
                                <span className="text-sm text-gray-500">※現在のプラン: <b>{currentPlanConfig?.name || currentPlanId}</b></span>
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {availablePlans.map((plan) => (
                                    <div
                                        key={plan.id}
                                        className={`border-2 rounded-xl p-5 cursor-pointer transition-all hover:border-blue-300 hover:bg-blue-50 ${selectedPlanId === plan.id ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-gray-200'}`}
                                        onClick={() => handleSelectPlan(plan.id)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-lg">{plan.name}</h4>
                                            {plan.id === 'professional' && <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">人気</span>}
                                        </div>
                                        <div className="text-2xl font-bold text-blue-600 mb-4">
                                            {formatCurrencyJP(plan.price)}<span className="text-sm text-gray-500 font-normal">/月</span>
                                        </div>
                                        <ul className="space-y-2 text-sm text-gray-600">
                                            {plan.features.slice(0, 3).map((feature, i) => (
                                                <li key={i} className="flex items-start">
                                                    <span className="text-green-500 mr-2">✔</span>
                                                    {feature}
                                                </li>
                                            ))}
                                            <li className="text-xs text-gray-400 pt-1">...他</li>
                                        </ul>
                                    </div>
                                ))}

                                {availablePlans.length === 0 && (
                                    <div className="col-span-2 text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                                        変更可能なプランがありません
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'confirm' && targetPlan && (
                        <div className="space-y-6 text-center">
                            <h4 className="text-xl font-bold text-gray-800">
                                {targetPlan.name}に変更しますか？
                            </h4>

                            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 inline-block w-full max-w-sm">
                                <div className="text-sm text-gray-500 mb-1">新しい月額料金</div>
                                <div className="text-3xl font-bold text-blue-600">
                                    {formatCurrencyJP(targetPlan.price)}<span className="text-sm">/月</span>
                                </div>
                            </div>

                            {/* 警告表示（ダウングレードや料金変更について） */}
                            <div className="text-left bg-yellow-50 p-4 rounded-lg text-sm text-yellow-800 space-y-2">
                                <p className="font-bold">⚠️ ご確認ください</p>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>プラン変更は即時適用されるか、または差額決済が必要になる場合があります。</li>
                                    <li>ダウングレードの場合、契約期間によっては違約金が発生する場合があります。</li>
                                    <li>「変更を確定する」を押すと、必要に応じて決済画面へ移動します。</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="py-12 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-gray-600 font-medium">処理中です...</p>
                            <p className="text-sm text-gray-400 mt-2">画面を閉じないでお待ちください</p>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 bg-red-50 text-red-600 p-4 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex justify-between items-center">
                    {step === 'select' ? (
                        <div className="text-xs text-gray-400">※いつでもキャンセル可能です</div>
                    ) : (
                        <button
                            onClick={handleBack}
                            disabled={loading}
                            className="text-gray-600 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-50"
                        >
                            戻る
                        </button>
                    )}

                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium transition-colors disabled:opacity-50"
                        >
                            キャンセル
                        </button>

                        {step === 'select' && selectedPlanId && (
                            <button
                                onClick={() => setStep('confirm')}
                                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                次へ
                            </button>
                        )}

                        {step === 'confirm' && (
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center"
                            >
                                {loading ? '処理中...' : '変更を確定する'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
