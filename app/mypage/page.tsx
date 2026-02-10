'use client'

import { useState, useEffect, Suspense } from 'react'
import { calculateMonthsElapsed, PLAN_CONFIG, formatDateJP } from '@/lib/subscription-utils'
import { CancellationModal } from '@/components/subscription/CancellationModal'
import { ChangePlanModal } from '@/components/subscription/ChangePlanModal'
import { SubscriptionDetails } from '@/types/subscription'

import { supabase } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

// テスト用LINE ID (開発環境のみ使用)
const DUMMY_USER_ID = 'U1234567890abcdef1234567890abcdef'
const IS_DEV = process.env.NODE_ENV === 'development'

function MyPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // デバッグログ用State
    const [debugLogs, setDebugLogs] = useState<string[]>(['Init MyPageContent'])
    const addLog = (msg: string) => setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()} ${msg}`].slice(-20))

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isChangePlanModalOpen, setIsChangePlanModalOpen] = useState(false)
    const [testUserId, setTestUserId] = useState(DUMMY_USER_ID)
    // const [userId, setUserId] = useState<string | null>(null) // 未使用のためコメントアウト

    useEffect(() => {
        const loadData = async () => {
            addLog('Start loadData')
            setLoading(true)
            try {
                // URLパラメータを取得（LINEからのアクセス用）
                const uid = searchParams.get('uid')
                const sig = searchParams.get('sig')
                addLog(`Params: uid=${uid?.slice(0, 5)}..., sig=${sig?.slice(0, 5)}...`)

                // 1. セッション取得
                addLog('Fetching session...')
                const { data: { session }, error: sessionError } = await supabase.auth.getSession()

                if (sessionError) {
                    addLog(`Session Error: ${sessionError.message}`)
                } else {
                    addLog(`Session: ${session ? 'Active' : 'None'}`)
                }

                let currentUserId = session?.user?.id

                // 優先順位: 
                // 1. 署名付きURL (Signed URL) - 未ログインでも許可
                // 2. ログインセッション (Standard Auth)

                // セッションがなく、かつ署名付きURLでもない場合はログイン画面へ
                if (!session && !IS_DEV && (!uid || !sig)) {
                    addLog('Redirecting to login (No session/No params)')
                    router.push('/auth/login')
                    return
                }

                // 開発環境でセッションがない場合はダミーIDを使用（動作確認用）
                if (!session && IS_DEV) {
                    currentUserId = testUserId // デバッグパネルのIDを使用
                    addLog('Using DEV dummy user')
                }

                // setUserId(uid || currentUserId || null)

                // 2. データ取得
                let res
                if (uid && sig) {
                    // LINE署名付きURLからのアクセス（最優先）
                    // setUserId(uid)
                    const fetchUrl = `/api/subscription?userId=${encodeURIComponent(uid)}&signature=${encodeURIComponent(sig)}` // エンコードを追加
                    addLog(`Fetching with Signed URL: ${fetchUrl}`)
                    res = await fetch(fetchUrl)
                } else if (session) {
                    // 本番: 認証トークンを使ってセキュアに取得
                    addLog('Fetching with Session Token')
                    res = await fetch('/api/subscription', {
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`
                        }
                    })
                } else if (IS_DEV) {
                    // 開発環境: デバッグ用APIを使用
                    addLog('Fetching with DEV API')
                    res = await fetch(`/api/debug/subscription?userId=${testUserId}`)
                } else {
                    addLog('No valid auth method found')
                    return // 上記のチェックでリダイレクト済みのはず
                }

                addLog(`Fetch Result: status=${res.status}, ok=${res.ok}`)

                if (!res.ok) {
                    if (res.status === 401) {
                        // 署名付きURLでのアクセス失敗時はエラーを表示（リダイレクトしない）
                        if (uid && sig) {
                            addLog('401 Unauthorized for Signed URL')
                            throw new Error('リンクが無効か期限切れです。LINEから再度アクセスしてください。')
                        }
                        addLog('401 Unauthorized, redirecting...')
                        router.push('/auth/login')
                        return
                    }
                    const errorText = await res.text()
                    addLog(`API Error Body: ${errorText}`)
                    throw new Error(`Failed to fetch subscription: ${res.status}`)
                }

                const data = await res.json()
                addLog('Data parsed successfully')

                if (!data || !data.subscription) {
                    // データがない場合は無料/未契約として表示
                    addLog('No subscription data found')
                    setSubscription(null)
                } else {
                    const subData = data.subscription
                    addLog(`Subscription data found: status=${subData.status}`)
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
                        rawStartDate: subData.contract_start_date,
                        price: subData.current_plan_price,
                        monthsElapsed: elapsed,
                        contractEndDate: formatDateJP(endDate),
                        isContractFulfilled: elapsed >= minimumMonths,
                        nextBillingDate: formatDateJP(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) // 簡易表示
                    })
                }
            } catch (e: any) {
                console.error('Failed to load subscription data', e)
                addLog(`Catch Error: ${e.message}`)
                setError(e.message || 'データの取得に失敗しました')
            } finally {
                setLoading(false)
                addLog('Loading finished')
            }
        }

        loadData()
    }, [testUserId, router, searchParams]) // addLogは依存配列に入れない（無限ループ防止）

    // デバッグ表示用コンポーネント
    const debugConsole = (
        <div className="fixed top-0 left-0 right-0 bg-black/80 text-green-400 p-2 text-xs font-mono max-h-48 overflow-y-auto z-50 opacity-90 pointer-events-none">
            {debugLogs.map((log, i) => (
                <div key={i}>{log}</div>
            ))}
        </div>
    )

    // エラー表示
    if (!loading && error) {
        return (
            <div className="py-8 space-y-8">
                {debugConsole}
                <div className="bg-red-50 rounded-xl p-8 text-center shadow-sm border border-red-200 mx-4 mt-12">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">エラーが発生しました</h2>
                    <p className="text-red-600 mb-4 font-bold">{error}</p>
                    <p className="text-xs text-gray-500 mb-4 whitespace-pre-wrap text-left bg-white p-2 border rounded">
                        Debug Info:<br />
                        {debugLogs.slice(-5).join('\n')}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                    >
                        再読み込み
                    </button>
                </div>
            </div>
        )
    }

    // 表示ロジック: データがない（無料）場合
    if (!loading && !subscription) {
        return (
            <div className="py-8 space-y-8">
                {debugConsole}
                <div className="mt-12 bg-white rounded-xl p-8 text-center shadow-sm border border-gray-200 mx-4">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">契約内容の確認</h2>
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
        return (
            <div>
                {debugConsole}
                <div className="flex justify-center items-center min-h-[50vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <div className="ml-4 text-gray-600">読み込み中...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="py-8 space-y-8 mx-4">
            {debugConsole}
            {/* ヘッダー */}
            <div className="flex justify-between items-end border-b border-gray-200 pb-4 mt-12">
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
                        <button
                            onClick={() => setIsChangePlanModalOpen(true)}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                        >
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

            {/* デバッグパネル（開発環境のみ表示） */}
            {IS_DEV && <DebugPanel testUserId={testUserId} setTestUserId={setTestUserId} setLoading={setLoading} />}

            {subscription && (
                <>
                    <CancellationModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        subscription={subscription}
                        userId={testUserId}
                    />
                    <ChangePlanModal
                        isOpen={isChangePlanModalOpen}
                        onClose={() => setIsChangePlanModalOpen(false)}
                        currentPlanId={subscription.planId}
                        userId={testUserId}
                    />
                </>
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

export default function MyPage() {
    return (
        <div className="min-h-screen bg-gray-50 pb-20 pt-8">
            <div className="container mx-auto px-4 max-w-3xl">
                <Suspense fallback={
                    <div className="flex justify-center items-center min-h-[50vh]">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        <div className="ml-4 text-gray-600">Loading Suspense...</div>
                    </div>
                }>
                    <MyPageContent />
                </Suspense>
            </div>
        </div>
    )
}
