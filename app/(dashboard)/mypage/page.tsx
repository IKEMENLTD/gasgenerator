'use client'

import { useState, useEffect } from 'react'
import { calculateMonthsElapsed, PLAN_CONFIG, formatDateJP } from '@/lib/subscription-utils'
import { CancellationModal } from '@/components/subscription/CancellationModal'
import { ChangePlanModal } from '@/components/subscription/ChangePlanModal'
import { SubscriptionDetails } from '@/types/subscription'

import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// テスト用LINE ID (開発環境のみ使用)
const DUMMY_USER_ID = 'U1234567890abcdef1234567890abcdef'
const IS_DEV = process.env.NODE_ENV === 'development'

export default function MyPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isChangePlanModalOpen, setIsChangePlanModalOpen] = useState(false)
    const [testUserId, setTestUserId] = useState(DUMMY_USER_ID)
    const [userId, setUserId] = useState<string | null>(null)

    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            try {
                // 1. セッション取得
                const { data: { session } } = await supabase.auth.getSession()

                let currentUserId = session?.user?.id

                // 開発環境かつデバッグパネルでIDが設定されていればそちらを優先（デバッグ用）
                if (IS_DEV && testUserId !== DUMMY_USER_ID) {
                    // 注: 本来は開発環境でも自分のIDを使うべきだが、デバッグパネルの機能維持のため
                    // ここではAPI側がuserIdパラメータを受け取るデバッグモードが必要
                    // しかし今回は本番安全化が優先なので、デバッグパネルの機能は制限される
                }

                if (!session && !IS_DEV) {
                    // 本番で未ログインならリダイレクト
                    router.push('/auth/login')
                    return
                }

                // 開発環境でセッションがない場合はダミーIDを使用（動作確認用）
                if (!session && IS_DEV) {
                    currentUserId = testUserId // デバッグパネルのIDを使用
                }

                setUserId(currentUserId || null)

                // 2. データ取得
                let res
                if (session) {
                    // 本番: 認証トークンを使ってセキュアに取得
                    res = await fetch('/api/subscription', {
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`
                        }
                    })
                } else if (IS_DEV) {
                    // 開発環境: デバッグ用APIを使用
                    res = await fetch(`/api/debug/subscription?userId=${testUserId}`)
                } else {
                    return // リダイレクト済み
                }

                if (!res.ok) {
                    if (res.status === 401) {
                        router.push('/auth/login')
                        return
                    }
                    throw new Error('Failed to fetch subscription')
                }

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
                        rawStartDate: subData.contract_start_date, // 追加: 計算用の生データ
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
    }, [testUserId, router])

    // 表示ロジック: データがない（無料）場合
    if (!loading && !subscription) {
        return (
            <div className="py-8 space-y-8">
                <h2 className="text-2xl font-bold text-gray-900">契約内容の確認</h2>
                <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-200">
                    <p className="text-gray-500 mb-4">現在契約中の有料プランはありません。</p>
                    {IS_DEV && (
                        <div className="text-sm bg-gray-50 p-4 rounded-lg inline-block text-left">
                            <p className="font-bold mb-2">💡 テストの始め方</p>
                            下の「テスト用コントロールパネル」から<br />
                            <span className="font-bold text-blue-600">「💎 Premium (新規)」</span>を押すと契約状態を作成できます。
                        </div>
                    )}
                </div>

                {/* デバッグパネル（開発環境のみ表示） */}
                {IS_DEV && <DebugPanel testUserId={testUserId} setTestUserId={setTestUserId} setLoading={setLoading} />}
            </div>
        )
    }

    if (loading) {
        // ... (中略) ...
        {/* メインカード */ }
        {
            subscription && (
// ... (中略) ...
            )
        }

        {/* デバッグパネル（開発環境のみ表示） */ }
        { IS_DEV && <DebugPanel testUserId={testUserId} setTestUserId={setTestUserId} setLoading={setLoading} /> }

        {
            subscription && (
                <>
                    <CancellationModal
                        // ... (後略) ...

                        function DebugPanel({testUserId, setTestUserId: _setTestUserId, setLoading }: any) {
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
