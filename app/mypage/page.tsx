'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter, useSearchParams } from 'next/navigation'

// ==========================================
// 🚨 ZERO-BASE SAFE IMPLEMENTATION 🚨
// 外部ファイルのインポートを排除し、クラッシュ要因を完全に除去しています。
// ==========================================

// --- Types & Config (Copied from utils to avoid imports) ---
const PLAN_CONFIG = {
    basic: {
        id: 'basic',
        name: 'ベーシックプラン',
        price: 10000,
    },
    professional: {
        id: 'professional',
        name: 'プロフェッショナルプラン',
        price: 50000,
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

// ---------------------------------------------------------

// テスト用LINE ID (開発環境のみ使用)
const DUMMY_USER_ID = 'U1234567890abcdef1234567890abcdef'
const IS_DEV = process.env.NODE_ENV === 'development'

function MyPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // デバッグログ用State
    const [debugLogs, setDebugLogs] = useState<string[]>(['Init MyPageContent (Self-Contained)'])
    const addLog = (msg: string) => setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()} ${msg}`].slice(-20))

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [subscription, setSubscription] = useState<any | null>(null)

    // Modals temporarily disabled for stability check
    // const [isModalOpen, setIsModalOpen] = useState(false)
    // const [isChangePlanModalOpen, setIsChangePlanModalOpen] = useState(false)

    useEffect(() => {
        const loadData = async () => {
            addLog('Start loadData')
            setLoading(true)

            try {
                // Local Supabase Client Construction
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
                const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

                if (!supabaseUrl || !supabaseAnonKey) {
                    throw new Error('Missing Env Vars')
                }

                const supabase = createClient(supabaseUrl, supabaseAnonKey)

                // URLパラメータを取得
                const uid = searchParams.get('uid')
                const sig = searchParams.get('sig')
                addLog(`Params: uid=${uid?.slice(0, 5)}..., sig=${sig?.slice(0, 5)}...`)

                // セッション取得
                addLog('Fetching session...')
                const { data: { session }, error: sessionError } = await supabase.auth.getSession()

                if (sessionError) addLog(`Session Error: ${sessionError.message}`)
                else addLog(`Session: ${session ? 'Active' : 'None'}`)

                // Redirect Check
                if (!session && !IS_DEV && (!uid || !sig)) {
                    addLog('Redirecting to login...')
                    router.push('/auth/login')
                    return
                }

                // API Fetch
                let res
                if (uid && sig) {
                    const fetchUrl = `/api/subscription?userId=${encodeURIComponent(uid)}&signature=${encodeURIComponent(sig)}`
                    addLog(`Fetching: ${fetchUrl}`)
                    res = await fetch(fetchUrl)
                } else if (session) {
                    addLog('Fetching with Session')
                    res = await fetch('/api/subscription', {
                        headers: { 'Authorization': `Bearer ${session.access_token}` }
                    })
                } else if (IS_DEV) {
                    addLog('Fetching DEV')
                    res = await fetch(`/api/debug/subscription?userId=${DUMMY_USER_ID}`)
                } else {
                    return
                }

                addLog(`Fetch Status: ${res.status}`)

                if (!res.ok) {
                    const text = await res.text()
                    addLog(`Error Body: ${text.slice(0, 50)}`)
                    if (res.status === 401 && uid && sig) {
                        throw new Error('リンク期限切れ/無効')
                    }
                    throw new Error(`Fetch failed: ${res.status}`)
                }

                const data = await res.json()
                addLog('Data parsed')

                if (!data || !data.subscription) {
                    addLog('No subscription')
                    setSubscription(null)
                } else {
                    const subData = data.subscription
                    addLog(`Sub Found: ${subData.status}`)

                    const startDate = new Date(subData.contract_start_date)
                    const elapsed = calculateMonthsElapsed(startDate)
                    const planConfig = Object.values(PLAN_CONFIG).find((p: any) => p.id === subData.current_plan_id) || PLAN_CONFIG.basic

                    setSubscription({
                        ...subData,
                        planName: planConfig.name,
                        monthsElapsed: elapsed,
                        contractStartDate: formatDateJP(startDate)
                    })
                }

            } catch (e: any) {
                console.error(e)
                addLog(`Error: ${e.message}`)
                setError(e.message)
            } finally {
                setLoading(false)
                addLog('Done')
            }
        }

        loadData()
    }, [searchParams, router])

    const debugConsole = (
        <div className="fixed top-0 left-0 right-0 bg-black/90 text-green-400 p-2 text-xs font-mono max-h-48 overflow-y-auto z-50 opacity-90 pointer-events-none">
            {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
    )

    if (error) {
        return <div className="p-8 space-y-4">
            {debugConsole}
            <h1 className="text-xl font-bold text-red-600">Error</h1>
            <p>{error}</p>
        </div>
    }

    if (loading) {
        return <div className="p-8">
            {debugConsole}
            <p>Loading...</p>
        </div>
    }

    if (!subscription) {
        return <div className="p-8">
            {debugConsole}
            <h1 className="text-xl font-bold">No Subscription</h1>
        </div>
    }

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-6">
            {debugConsole}
            <h1 className="text-2xl font-bold">契約内容</h1>
            <div className="bg-white p-6 rounded shadow border">
                <p className="text-lg font-bold text-blue-600">{subscription.planName}</p>
                <p>月額: {subscription.current_plan_price?.toLocaleString()}円</p>
                <p>開始日: {subscription.contractStartDate}</p>
                <p>経過月数: {subscription.monthsElapsed}ヶ月</p>
            </div>
            {/* Warning: Modals are disabled for debugging */}
            <p className="text-xs text-gray-500">※現在メンテナンスモードです（解約・変更ボタン一時停止中）</p>
        </div>
    )
}

export default function MyPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <Suspense fallback={<div>Loading Page...</div>}>
                <MyPageContent />
            </Suspense>
        </div>
    )
}
