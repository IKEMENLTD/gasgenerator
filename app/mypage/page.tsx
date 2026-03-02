'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'

// ==========================================
// 🛡️ UTILS & CONSTANTS (Locally Defined)
// ==========================================

const MINIMUM_MONTHS = 6

const PLAN_CONFIG = {
    basic: {
        id: 'basic',
        name: 'ベーシックプラン',
        price: 10000,
        features: [
            'システムダウンロード権限',
            '初期セットアップマニュアル',
            'AIチャットサポート',
            '自己設置（セルフサポート）'
        ]
    },
    professional: {
        id: 'professional',
        name: 'プロフェッショナルプラン',
        price: 50000,
        features: [
            'システムダウンロード権限',
            '月3システムまで設置代行',
            'コーディング代行サービス',
            '月1回無料ミーティング',
            '優先技術サポート'
        ]
    }
}

function calculateMonthsElapsed(contractStartDate: string | Date) {
    const start = new Date(contractStartDate)
    const today = new Date()
    const yearDiff = today.getFullYear() - start.getFullYear()
    const monthDiff = today.getMonth() - start.getMonth()
    let totalMonths = yearDiff * 12 + monthDiff
    if (today.getDate() < start.getDate()) {
        totalMonths -= 1
    }
    return Math.max(0, totalMonths)
}

function formatDateJP(date: string | Date) {
    return new Date(date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatCurrencyJP(amount: number) {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)
}

function calculateCancellationFee(contractStartDate: string | Date, currentPrice: number) {
    const elapsed = calculateMonthsElapsed(contractStartDate)
    const remaining = Math.max(0, MINIMUM_MONTHS - elapsed)
    if (remaining === 0) {
        return { fee: 0, remainingMonths: 0, isFree: true }
    }
    return { fee: currentPrice * remaining, remainingMonths: remaining, isFree: false }
}

// ==========================================
// 🧩 SUB-COMPONENTS (Inline Modals)
// ==========================================

function CancellationModal({ isOpen, onClose, subscription }: any) {
    const [step, setStep] = useState<'confirm' | 'calculating' | 'fee-check' | 'processing' | 'completed' | 'error'>('confirm')
    const [feeInfo, setFeeInfo] = useState<any>(null)
    const [errorMessage, setErrorMessage] = useState('')

    const handleClose = () => {
        setStep('confirm')
        setFeeInfo(null)
        setErrorMessage('')
        onClose()
    }

    if (!isOpen) return null

    const handleCheckFee = async () => {
        setStep('calculating')
        await new Promise(r => setTimeout(r, 800))
        const info = calculateCancellationFee(subscription.rawStartDate, subscription.price)
        setFeeInfo(info)
        setStep('fee-check')
    }

    const handleProceed = async () => {
        setStep('processing')
        setErrorMessage('')
        try {
            const res = await fetch('/api/subscription/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: subscription.userId })
            })
            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || '解約処理に失敗しました')
            }
            if (data.requiresPayment && data.checkoutUrl) {
                window.location.href = data.checkoutUrl
                return
            }
            setStep('completed')
        } catch (e: any) {
            console.error('Cancellation error:', e)
            setErrorMessage(e.message || '予期せぬエラーが発生しました')
            setStep('error')
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                <h3 className="font-bold text-lg mb-4">プラン解約の手続き</h3>

                {step === 'confirm' && (
                    <div className="space-y-4">
                        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl text-sm">
                            <span className="font-bold">⚠️ 最低利用期間の確認</span><br />
                            本プランには6ヶ月の最低利用期間があります。期間内の解約には違約金が発生する場合があります。
                        </div>
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={handleClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
                            <button onClick={handleCheckFee} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">手続きを進める</button>
                        </div>
                    </div>
                )}

                {step === 'calculating' && (
                    <div className="text-center py-8">
                        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                        <p className="text-sm text-gray-500">契約状況を確認中...</p>
                    </div>
                )}

                {step === 'fee-check' && feeInfo && (
                    <div className="space-y-4">
                        <div className="text-center bg-gray-50 p-4 rounded-xl">
                            {feeInfo.fee > 0 ? (
                                <>
                                    <p className="text-sm text-gray-500 mb-1">違約金（残 {feeInfo.remainingMonths}ヶ月分）</p>
                                    <p className="text-2xl font-bold text-red-600">{formatCurrencyJP(feeInfo.fee)}</p>
                                    <p className="text-xs text-gray-400 mt-1">{formatCurrencyJP(subscription.price)} x {feeInfo.remainingMonths}ヶ月</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-500 mb-1">違約金</p>
                                    <p className="text-2xl font-bold text-green-600">{formatCurrencyJP(0)}</p>
                                    <p className="text-xs text-gray-400 mt-1">最低利用期間を満了しています</p>
                                </>
                            )}
                        </div>
                        {feeInfo.fee === 0 && (
                            <p className="text-xs text-gray-500 text-center">次回更新日に解約が適用されます。それまでは引き続きご利用いただけます。</p>
                        )}
                        {feeInfo.fee > 0 && (
                            <p className="text-xs text-gray-500 text-center">Stripeの決済画面に進みます。決済完了後に解約が確定します。</p>
                        )}
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={handleClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
                            <button onClick={handleProceed} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold">
                                {feeInfo.fee > 0 ? '違約金を支払って解約' : '解約を確定する'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'processing' && (
                    <div className="text-center py-8">
                        <div className="animate-spin h-8 w-8 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-2" />
                        <p className="text-sm text-gray-500">解約処理を実行中...</p>
                    </div>
                )}

                {step === 'completed' && (
                    <div className="text-center py-6 space-y-4">
                        <div className="text-4xl">✅</div>
                        <h4 className="font-bold text-lg">解約手続きが完了しました</h4>
                        <p className="text-sm text-gray-600">次回更新日をもってサービスが停止されます。<br />それまでは引き続きご利用いただけます。</p>
                        <p className="text-xs text-gray-400">再度ご契約いただく場合は、いつでもプランページからお手続きいただけます。</p>
                        <button onClick={() => { handleClose(); window.location.reload() }} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold">閉じる</button>
                    </div>
                )}

                {step === 'error' && (
                    <div className="text-center py-6 space-y-4">
                        <div className="text-4xl">❌</div>
                        <h4 className="font-bold text-lg text-red-600">エラーが発生しました</h4>
                        <p className="text-sm text-gray-600">{errorMessage}</p>
                        <div className="flex justify-center gap-3">
                            <button onClick={handleClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">閉じる</button>
                            <button onClick={() => setStep('fee-check')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold">もう一度試す</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function ChangePlanModal({ isOpen, onClose, currentPlanId, subscription }: any) {
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
    const [step, setStep] = useState('select')
    const [loading, setLoading] = useState(false)
    const [feeInfo, setFeeInfo] = useState<any>(null)

    if (!isOpen) return null

    // Configを配列化して現在のプラン以外を抽出
    const availablePlans = Object.values(PLAN_CONFIG).filter((p: any) => p.id !== currentPlanId)
    const currentPlanConfig = Object.values(PLAN_CONFIG).find((p: any) => p.id === currentPlanId)
    const selectedPlanConfig = Object.values(PLAN_CONFIG).find((p: any) => p.id === selectedPlanId)

    // ダウングレード判定: 現在のプランより安いプランへの変更
    const isDowngrade = currentPlanConfig && selectedPlanConfig && selectedPlanConfig.price < currentPlanConfig.price

    const handleNext = async () => {
        if (!selectedPlanId) return

        // ダウングレードの場合、違約金チェックを挟む
        if (isDowngrade && subscription?.rawStartDate) {
            const info = calculateCancellationFee(subscription.rawStartDate, subscription.price || currentPlanConfig!.price)
            setFeeInfo(info)
            if (!info.isFree) {
                setStep('fee-warning')
                return
            }
        }
        setStep('confirm')
    }

    const handleSubmit = async () => {
        if (!selectedPlanId) return
        setLoading(true)
        try {
            const res = await fetch('/api/subscription/change-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: subscription?.user_id, // LINE User ID
                    newPlanId: selectedPlanId
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'プラン変更に失敗しました')
            }

            if (data.requiresPayment && data.checkoutUrl) {
                // 違約金支払いが必要な場合
                window.location.href = data.checkoutUrl
                return
            }

            alert('プラン変更が完了しました！\n新しい契約期間が開始されます。')
            onClose()
            window.location.reload()

        } catch (e: any) {
            console.error(e)
            alert(e.message || 'エラーが発生しました')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 h-[80vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                <h3 className="font-bold text-lg mb-4">プラン変更</h3>

                {step === 'select' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {availablePlans.map((plan: any) => (
                                <div key={plan.id}
                                    onClick={() => setSelectedPlanId(plan.id)}
                                    className={`border-2 rounded-xl p-4 cursor-pointer hover:bg-blue-50 transition-colors ${selectedPlanId === plan.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                                >
                                    <div className="font-bold text-lg mb-1">{plan.name}</div>
                                    <div className="text-blue-600 font-bold text-xl mb-2">{formatCurrencyJP(plan.price)}<span className="text-sm text-gray-400">/月</span></div>
                                    <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
                                        {plan.features.slice(0, 3).map((f: string, i: number) => <li key={i}>{f}</li>)}
                                    </ul>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">キャンセル</button>
                            <button
                                onClick={handleNext}
                                disabled={!selectedPlanId}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-bold"
                            >
                                次へ
                            </button>
                        </div>
                    </div>
                )}

                {/* ダウングレード時の違約金警告ステップ */}
                {step === 'fee-warning' && feeInfo && (
                    <div className="space-y-6">
                        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-2xl">⚠️</span>
                                <h4 className="font-bold text-red-800 text-lg">ダウングレードに伴う違約金</h4>
                            </div>
                            <p className="text-red-700 text-sm mb-4">
                                最低利用期間（6ヶ月）を満たしていないため、以下の違約金が発生します。
                            </p>

                            <div className="bg-white rounded-lg p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">現在のプラン月額</span>
                                    <span className="font-bold">{formatCurrencyJP(subscription?.price || currentPlanConfig?.price || 0)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">残り契約期間</span>
                                    <span className="font-bold text-red-600">{feeInfo.remainingMonths}ヶ月</span>
                                </div>
                                <hr className="my-2" />
                                <div className="flex justify-between text-lg">
                                    <span className="font-bold text-gray-800">違約金合計</span>
                                    <span className="font-bold text-red-600">{formatCurrencyJP(feeInfo.fee)}</span>
                                </div>
                            </div>

                            <p className="text-xs text-red-600 mt-3">
                                ※ 計算式: {formatCurrencyJP(subscription?.price || currentPlanConfig?.price || 0)} × {feeInfo.remainingMonths}ヶ月 = {formatCurrencyJP(feeInfo.fee)}
                            </p>
                        </div>

                        <div className="text-center">
                            <p className="text-sm text-gray-600 mb-1">変更先プラン</p>
                            <p className="text-xl font-bold text-blue-600">{selectedPlanConfig?.name}</p>
                        </div>

                        <div className="flex justify-center gap-4">
                            <button onClick={() => { setStep('select'); setFeeInfo(null); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                                戻る
                            </button>
                            <button onClick={() => setStep('confirm')} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold">
                                違約金を了承して進む
                            </button>
                        </div>
                    </div>
                )}

                {step === 'confirm' && (
                    <div className="space-y-6 text-center">
                        <p className="text-lg font-bold">変更内容の確認</p>
                        <div className="py-4">
                            以下のプランに変更しますか？
                            <div className="text-2xl font-bold text-blue-600 mt-2">
                                {selectedPlanConfig?.name}
                            </div>
                        </div>

                        {feeInfo && !feeInfo.isFree && (
                            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                                ⚠️ 違約金 {formatCurrencyJP(feeInfo.fee)} が発生します
                            </div>
                        )}

                        <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">
                            📋 プラン変更後、新たに6ヶ月の最低利用期間が開始されます
                        </div>

                        <div className="flex justify-center gap-4">
                            <button onClick={() => setStep(feeInfo && !feeInfo.isFree ? 'fee-warning' : 'select')} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">戻る</button>
                            <button onClick={handleSubmit} disabled={loading} className={`px-6 py-2 text-white rounded-lg font-bold ${feeInfo && !feeInfo.isFree ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                                {loading ? '処理中...' : '変更を確定する'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ==========================================
// 🚀 MAIN PAGE COMPONENT
// ==========================================

// テスト用LINE ID (開発環境のみ使用)
const DUMMY_USER_ID = 'U1234567890abcdef1234567890abcdef'
const IS_DEV = process.env.NODE_ENV === 'development'

function MyPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // State
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [subscription, setSubscription] = useState<any | null>(null)
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
    const [isChangePlanModalOpen, setIsChangePlanModalOpen] = useState(false)
    const [testUserId, setTestUserId] = useState(DUMMY_USER_ID) // Dev用

    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            try {
                // Local Supabase Client Construction
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
                const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                if (!supabaseUrl || !supabaseAnonKey) throw new Error('System Config Error')
                const supabase = createClient(supabaseUrl, supabaseAnonKey)

                // Params & Session
                const uid = searchParams.get('uid')
                const sig = searchParams.get('sig')
                const { data: { session } } = await supabase.auth.getSession()

                // Auth Check
                if (!session && !IS_DEV && (!uid || !sig)) {
                    router.push('/auth/login')
                    return
                }

                // Fetch Strategy
                let res
                if (uid && sig) {
                    res = await fetch(`/api/subscription?userId=${encodeURIComponent(uid)}&signature=${encodeURIComponent(sig)}`)
                } else if (session) {
                    res = await fetch('/api/subscription', { headers: { 'Authorization': `Bearer ${session.access_token}` } })
                } else if (IS_DEV) {
                    res = await fetch(`/api/debug/subscription?userId=${testUserId}`)
                } else {
                    return
                }

                if (!res.ok) {
                    if (res.status === 401 && uid && sig) throw new Error('リンクの有効期限が切れています。LINEから再度アクセスしてください。')
                    throw new Error('データの取得に失敗しました')
                }

                const data = await res.json()

                if (!data || !data.subscription) {
                    setSubscription(null)
                } else {
                    const subData = data.subscription
                    const startDate = new Date(subData.contract_start_date)
                    const elapsed = calculateMonthsElapsed(startDate)
                    const planConfig = Object.values(PLAN_CONFIG).find((p: any) => p.id === subData.current_plan_id) || PLAN_CONFIG.basic

                    // 6ヶ月後の日付計算
                    const endDate = new Date(startDate)
                    endDate.setMonth(endDate.getMonth() + MINIMUM_MONTHS)

                    setSubscription({
                        ...subData,
                        userId: subData.user_id,
                        planId: subData.current_plan_id, // Fix: explicit planId for ChangePlanModal
                        planName: planConfig.name,
                        price: subData.current_plan_price || planConfig.price,
                        monthsElapsed: elapsed,
                        contractStartDate: formatDateJP(startDate),
                        rawStartDate: subData.contract_start_date,
                        contractEndDate: formatDateJP(endDate),
                        isContractFulfilled: elapsed >= MINIMUM_MONTHS,
                        nextBillingDate: formatDateJP(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
                    })
                }

            } catch (e: any) {
                console.error(e)
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [searchParams, router, testUserId])

    // Loading State
    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    // Error State
    if (error) {
        return (
            <div className="py-12 text-center px-4">
                <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-200 inline-block max-w-md">
                    <h2 className="text-xl font-bold mb-2">エラーが発生しました</h2>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-white border border-red-300 rounded hover:bg-red-50">再読み込み</button>
                </div>
            </div>
        )
    }

    // No Subscription (Free) State
    if (!subscription) {
        return (
            <div className="py-12 space-y-6 max-w-2xl mx-auto px-4">
                <h2 className="text-2xl font-bold text-gray-900">契約内容の確認</h2>
                <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-200">
                    <p className="text-gray-500">現在契約中の有料プランはありません。</p>
                </div>
                {IS_DEV && <DevTools testUserId={testUserId} setTestUserId={setTestUserId} />}
            </div>
        )
    }

    // Active Subscription State
    return (
        <div className="py-8 space-y-8 max-w-4xl mx-auto px-4">
            {/* Header */}
            <div className="flex justify-between items-end border-b border-gray-200 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">契約内容の確認</h2>
                    <p className="text-gray-500 mt-1 text-sm">現在のプランと契約期間をご確認いただけます</p>
                </div>
                <div className="hidden sm:block">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${subscription.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {subscription.status === 'active' ? '契約中' : '解約済み'}
                    </span>
                </div>
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <div className="font-bold text-gray-700">現在のプラン</div>
                    <div className="text-blue-600 font-bold text-lg hidden sm:block">{subscription.planName}</div>
                </div>
                {/* Mobile Plan Name */}
                <div className="sm:hidden px-6 pt-4 font-bold text-xl text-blue-600">{subscription.planName}</div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Col */}
                    <div className="space-y-4">
                        <div>
                            <div className="text-sm text-gray-500 mb-1">月額料金</div>
                            <div className="text-3xl font-bold text-gray-900">
                                {formatCurrencyJP(subscription.price)}<span className="text-sm font-normal text-gray-500">/月</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-sm text-gray-500 mb-1">契約開始日</div>
                                <div className="font-medium">{subscription.contractStartDate}</div>
                            </div>
                            <div>
                                <div className="text-sm text-gray-500 mb-1">次回更新予定</div>
                                <div className="font-medium">{subscription.nextBillingDate}</div>
                            </div>
                        </div>
                    </div>

                    {/* Right Col: Contract Period */}
                    <div className={`rounded-xl p-5 border ${subscription.isContractFulfilled ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'}`}>
                        <h4 className={`font-bold mb-3 flex items-center ${subscription.isContractFulfilled ? 'text-green-800' : 'text-orange-800'}`}>
                            {subscription.isContractFulfilled ? '🎉 最低利用期間クリア' : '⏳ 最低利用期間（6ヶ月）'}
                        </h4>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">現在の経過期間</span>
                                <span className="font-bold text-lg">{subscription.monthsElapsed}ヶ月</span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-white rounded-full h-3 overflow-hidden shadow-inner">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${subscription.isContractFulfilled ? 'bg-green-500' : 'bg-orange-500'}`}
                                    style={{ width: `${Math.min(100, (subscription.monthsElapsed / MINIMUM_MONTHS) * 100)}%` }}
                                ></div>
                            </div>

                            {!subscription.isContractFulfilled && (
                                <p className="text-xs text-orange-800 mt-2">
                                    <span className="font-bold">{subscription.contractEndDate}</span> まで解約時に違約金が発生する可能性があります。
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-4">
                    <button onClick={() => setIsChangePlanModalOpen(true)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium shadow-sm transition-all">
                        プラン変更
                    </button>
                    <button onClick={() => setIsCancelModalOpen(true)} className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium transition-colors">
                        解約する
                    </button>
                </div>
            </div>

            {IS_DEV && <DevTools testUserId={testUserId} setTestUserId={setTestUserId} />}

            {/* Modals */}
            <CancellationModal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                subscription={subscription}
            />
            <ChangePlanModal
                isOpen={isChangePlanModalOpen}
                onClose={() => setIsChangePlanModalOpen(false)}
                currentPlanId={subscription.planId}
                subscription={subscription}
            />
        </div>
    )
}

function DevTools({ testUserId, setTestUserId }: any) {
    const handleAction = async (action: string, monthsAgo?: number) => {
        try {
            await fetch('/api/debug/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: testUserId, action, monthsAgo })
            })
            window.location.reload()
        } catch (e) { alert('Error') }
    }

    return (
        <div className="mt-8 p-4 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
            <h3 className="font-bold text-gray-600 mb-2 text-sm">🛠️ Developer Tools</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button onClick={() => handleAction('reset_free')} className="text-xs bg-gray-600 text-white p-2 rounded">Reset Free</button>
                <button onClick={() => handleAction('set_premium_new')} className="text-xs bg-blue-600 text-white p-2 rounded">New Premium</button>
                <button onClick={() => handleAction('set_premium_aged', 3)} className="text-xs bg-indigo-600 text-white p-2 rounded">3 Months Ago</button>
                <button onClick={() => handleAction('set_premium_aged', 6)} className="text-xs bg-green-600 text-white p-2 rounded">Fulfilled</button>
            </div>
        </div>
    )
}

export default function MyPage() {
    return (
        <div className="min-h-screen bg-gray-50 pb-20 pt-8">
            <Suspense fallback={<div className="text-center py-20">Loading...</div>}>
                <MyPageContent />
            </Suspense>
        </div>
    )
}
