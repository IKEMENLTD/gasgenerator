'use client'

import { useState } from 'react'
import { calculateCancellationFee, formatCurrencyJP } from '@/lib/subscription-utils'
import { SubscriptionDetails } from '@/types/subscription'

interface CancellationModalProps {
    isOpen: boolean
    onClose: () => void
    subscription: SubscriptionDetails
    userId: string
}

export function CancellationModal({ isOpen, onClose, subscription, userId }: CancellationModalProps) {
    const [step, setStep] = useState<'confirm' | 'calculating' | 'fee-check' | 'processing' | 'completed'>('confirm')
    const [feeInfo, setFeeInfo] = useState<any>(null)

    if (!isOpen) return null

    // 違約金計算
    const handleCheckFee = async () => {
        setStep('calculating')
        // 実際のアプリではここでサーバーサイドで再計算＆検証を行うべきだが、
        // UI表示用としてクライアントサイドのユーティリティを使用
        await new Promise(resolve => setTimeout(resolve, 800)) // 計算中の演出

        const info = calculateCancellationFee(subscription.contractStartDate, subscription.price)
        setFeeInfo(info)
        setStep('fee-check')
    }

    // 解約実行（または違約金支払い画面へ）
    const handleProceed = async () => {
        setStep('processing')

        // TODO: ここでAPIをコールして解約処理または違約金決済セッション作成を行う
        // const res = await fetch('/api/subscription/cancel', { ... })

        await new Promise(resolve => setTimeout(resolve, 1500)) // 処理中の演出

        alert('解約処理（または違約金決済への誘導）機能を実装予定です。\n\n違約金: ' + formatCurrencyJP(feeInfo?.cancellationFee || 0))
        setStep('completed')
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">プラン解約の手続き</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {step === 'confirm' && (
                        <div className="space-y-4">
                            <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl text-sm">
                                <p className="font-bold mb-1">⚠️ ご確認ください</p>
                                本プランには6ヶ月の最低利用期間が設けられています。
                                期間内の解約には、残期間分の違約金が発生する場合があります。
                            </div>
                            <p className="text-gray-600">
                                本当に解約手続きを進めますか？
                            </p>
                        </div>
                    )}

                    {step === 'calculating' && (
                        <div className="py-8 text-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-gray-500">契約状況を確認しています...</p>
                        </div>
                    )}

                    {step === 'fee-check' && feeInfo && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold mb-2 ${feeInfo.cancellationFee > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                    {feeInfo.cancellationFee > 0 ? '違約金が発生します' : '違約金は発生しません'}
                                </div>
                                {feeInfo.cancellationFee > 0 && (
                                    <div className="text-3xl font-bold text-gray-900 mt-2">
                                        {formatCurrencyJP(feeInfo.cancellationFee)}
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">現在のプラン</span>
                                    <span className="font-medium">{subscription.planName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">契約開始日</span>
                                    <span className="font-medium">{subscription.contractStartDate}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">経過月数</span>
                                    <span className="font-medium">{feeInfo.monthsElapsed}ヶ月</span>
                                </div>
                                <div className="flex justify-between border-t border-gray-200 pt-2">
                                    <span className="text-gray-500">最低利用期間の残月数</span>
                                    <span className="font-bold text-red-600">{feeInfo.remainingMonths}ヶ月</span>
                                </div>
                            </div>

                            {feeInfo.cancellationFee > 0 ? (
                                <p className="text-xs text-gray-500 text-center">
                                    解約を完了するには、上記の違約金をお支払いいただく必要があります。<br />
                                    「次へ」を押すと決済画面に進みます。
                                </p>
                            ) : (
                                <p className="text-xs text-gray-500 text-center">
                                    最低利用期間を満了しているため、違約金なしで解約可能です。<br />
                                    解約は次回の更新日（{subscription.nextBillingDate || '次回決済日'}）に適用されます。
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        キャンセル
                    </button>

                    {step === 'confirm' && (
                        <button
                            onClick={handleCheckFee}
                            className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                        >
                            手続きを進める
                        </button>
                    )}

                    {step === 'fee-check' && (
                        <button
                            onClick={handleProceed}
                            className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm flex items-center"
                        >
                            {feeInfo.cancellationFee > 0 ? '違約金を支払って解約' : '解約を確定する'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
