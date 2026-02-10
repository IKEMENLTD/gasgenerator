'use client'

import { useState, useEffect } from 'react'
import { calculateMonthsElapsed, PLAN_CONFIG, formatDateJP } from '@/lib/subscription-utils'
import { CancellationModal } from '@/components/subscription/CancellationModal'
import { SubscriptionDetails } from '@/types/subscription'

// テスト用LINE ID
const DUMMY_USER_ID = 'U1234567890abcdef1234567890abcdef'

export default function MyPage() {
    const [loading, setLoading] = useState(true)
    const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [testUserId, setTestUserId] = useState(DUMMY_USER_ID)

    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            try {
                // API経由で取得（RLS回避のため）
                const res = await fetch(`/api/debug/subscription?userId=${testUserId}`)
                if (!res.ok) throw new Error('Failed to fetch subscription')
                const { subscription: subData } = await res.json()

                if (!subData) {
                    // データがない場合は無料/未契約として表示
                    setSubscription(null)
                } else {
                    const startDate = new Date(subData.contract_start_date)
                    const elapsed = calculateMonthsElapsed(startDate)
                    const minimumMonths = 6

                    const endDate = new Date(startDate)
                    endDate.setMonth(endDate.getMonth() + minimumMonths)

                    // プラン設定を検索
                    const planConfig = Object.values(PLAN_CONFIG).find(p => p.id === subData.current_plan_id) || PLAN_CONFIG.basic

                    setSubscription({
                        planId: subData.current_plan_id,
                        planName: planConfig.name,
                        status: subData.status,
                        contractStartDate: formatDateJP(startDate),
                        price: subData.current_plan_price,
                        monthsElapsed: elapsed,
                        contractEndDate: formatDateJP(endDate),
                        isContractFulfilled: elapsed >= minimumMonths,
                        nextBillingDate: formatDateJP(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) // 簡易表示
                    })
                }
            } catch (e) {
                console.error('Failed to load subscription data', e)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [testUserId])

    // 表示ロジック: データがない（無料）場合
    if (!loading && !subscription) {
        return (
            <div className="py-8 space-y-8">
                <h2 className="text-2xl font-bold text-gray-900">契約内容の確認</h2>
                <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-200">
                    <p className="text-gray-500 mb-4">現在契約中の有料プランはありません。</p>
                    <div className="text-sm bg-gray-50 p-4 rounded-lg inline-block text-left">
                        <p className="font-bold mb-2">💡 テストの始め方</p>
                        下の「テスト用コントロールパネル」から<br />
                        <span className="font-bold text-blue-600">「💎 Premium (新規)」</span>を押すと契約状態を作成できます。
                    </div>
                </div>

                {/* デバッグパネル（未契約時も表示） */}
                <DebugPanel testUserId={testUserId} setTestUserId={setTestUserId} setLoading={setLoading} />
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    return (
        <div className="py-8 space-y-8">
            {/* ヘッダー */}
            <div className="flex justify-between items-end border-b border-gray-200 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">契約内容の確認</h2>
                    <p className="text-gray-500 mt-1">現在のプランと契約期間をご確認いただけます</p>
                </div>
                <div className="hidden sm:block">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${subscription?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {subscription?.status === 'active' ? '契約中' : '解約済み'}
                    </span>
                </div>
            </div>

            {/* メインカード */}
            {subscription && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                        <div className="font-bold text-gray-700">現在のプラン</div>
                        <div className="text-blue-600 font-bold text-lg">{subscription.planName}</div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* 左カラム：基本情報 */}
                        <div className="space-y-4">
                            <div>
                                <div className="text-sm text-gray-500 mb-1">月額料金</div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {subscription.price.toLocaleString()}円<span className="text-sm font-normal text-gray-500">/月</span>
                                </div>
                            </div>

                            <div>
                                <div className="text-sm text-gray-500 mb-1">契約開始日</div>
                                <div className="font-medium">{subscription.contractStartDate}</div>
                            </div>

                            <div>
                                <div className="text-sm text-gray-500 mb-1">次回更新予定日</div>
                                <div className="font-medium">{subscription.nextBillingDate}</div>
                            </div>
                        </div>

                        {/* 右カラム：契約期間情報（6ヶ月縛り） */}
                        <div className={`rounded-xl p-5 ${subscription.isContractFulfilled ? 'bg-green-50 border border-green-100' : 'bg-orange-50 border border-orange-100'}`}>
                            <h4 className={`font-bold mb-3 flex items-center ${subscription.isContractFulfilled ? 'text-green-800' : 'text-orange-800'}`}>
                                <span className="mr-2 text-xl">{subscription.isContractFulfilled ? '🎉' : '⏳'}</span>
                                最低利用期間（6ヶ月）
                            </h4>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">現在の経過期間</span>
                                    <span className="font-bold text-lg">{subscription.monthsElapsed}ヶ月</span>
                                </div>

                                {/* プログレスバー */}
                                <div className="w-full bg-white rounded-full h-3 overflow-hidden shadow-inner">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ${subscription.isContractFulfilled ? 'bg-green-500' : 'bg-orange-500'}`}
                                        style={{ width: `${Math.min(100, (subscription.monthsElapsed / 6) * 100)}%` }}
                                    ></div>
                                </div>

                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>0ヶ月</span>
                                    <span>3ヶ月</span>
                                    <span>6ヶ月（解約可能）</span>
                                </div>

                                {!subscription.isContractFulfilled && (
                                    <div className="mt-3 text-xs text-orange-700 bg-white/50 p-2 rounded">
                                        現在、最低利用期間内です。<br />
                                        <span className="font-bold">{subscription.contractEndDate}</span> まで解約時に違約金が発生します。
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* アクションボタン */}
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end space-x-4">
                        <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors">
                            プラン変更
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                        >
                            解約する
                        </button>
                    </div>
                </div>
            )}

            {/* デバッグパネル */}
            <DebugPanel testUserId={testUserId} setTestUserId={setTestUserId} setLoading={setLoading} />

            {subscription && (
                <CancellationModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    subscription={subscription}
                    userId={testUserId}
                />
            )}
        </div>
    )
}

function DebugPanel({ testUserId, setTestUserId: _setTestUserId, setLoading }: any) {
    return (
        <div className="mt-12 bg-gray-100 rounded-xl p-6 border-2 border-dashed border-gray-300">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center">
                <span className="text-xl mr-2">🛠️</span>
                テスト用コントロールパネル
                <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded">Dev Only</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <button
                    onClick={async () => {
                        setLoading(true)
                        try {
                            const res = await fetch('/api/debug/setup', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: testUserId, action: 'reset_free' })
                            })
                            const data = await res.json()
                            if (!res.ok) alert('Error: ' + (data.error || 'Unknown error'))
                            else {
                                // 少し待ってからリロード（DB反映待ち）
                                setTimeout(() => window.location.reload(), 1000)
                            }
                        } catch (e: any) {
                            alert('Fetch Error: ' + e.message)
                            setLoading(false)
                        }
                    }}
                    className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm font-medium"
                >
                    🗑️ 無料に戻す
                </button>

                <button
                    onClick={async () => {
                        setLoading(true)
                        try {
                            const res = await fetch('/api/debug/setup', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: testUserId, action: 'set_premium_new' })
                            })
                            const data = await res.json()
                            if (!res.ok) alert('Error: ' + (data.error || 'Unknown error'))
                            else {
                                setTimeout(() => window.location.reload(), 1000)
                            }
                        } catch (e: any) {
                            alert('Fetch Error: ' + e.message)
                            setLoading(false)
                        }
                    }}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                >
                    💎 Premium (新規)
                </button>

                <button
                    onClick={async () => {
                        setLoading(true)
                        try {
                            const res = await fetch('/api/debug/setup', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: testUserId, action: 'set_premium_aged', monthsAgo: 3 })
                            })
                            const data = await res.json()
                            if (!res.ok) alert('Error: ' + (data.error || 'Unknown error'))
                            else {
                                setTimeout(() => window.location.reload(), 1000)
                            }
                        } catch (e: any) {
                            alert('Fetch Error: ' + e.message)
                            setLoading(false)
                        }
                    }}
                    className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium"
                >
                    🕒 Premium (3ヶ月経過)
                </button>

                <button
                    onClick={async () => {
                        setLoading(true)
                        try {
                            const res = await fetch('/api/debug/setup', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: testUserId, action: 'set_premium_aged', monthsAgo: 6 })
                            })
                            const data = await res.json()
                            if (!res.ok) alert('Error: ' + (data.error || 'Unknown error'))
                            else {
                                setTimeout(() => window.location.reload(), 1000)
                            }
                        } catch (e: any) {
                            alert('Fetch Error: ' + e.message)
                            setLoading(false)
                        }
                    }}
                    className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                >
                    ✅ Premium (縛り完了)
                </button>
            </div>

            <p className="text-xs text-gray-500 mt-4">
                Target User ID: {testUserId}
            </p>
        </div>
    )
}
