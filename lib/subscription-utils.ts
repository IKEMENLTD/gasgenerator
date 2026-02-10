import { type PremiumStatus } from './premium/premium-checker'

/**
 * 契約起点日からの経過月数を計算
 * 
 * @param contractStartDate - 契約起点日（初回課金日）
 * @returns 経過月数（整数）
 * 
 * @example
 * 起点日: 2026-01-15
 * 現在日: 2026-03-20
 * → 2ヶ月経過（3月15日で2ヶ月、3月20日はまだ3ヶ月目）
 */
export function calculateMonthsElapsed(contractStartDate: Date | string): number {
    const start = new Date(contractStartDate)
    const today = new Date()

    // 年・月の差分を計算
    const yearDiff = today.getFullYear() - start.getFullYear()
    const monthDiff = today.getMonth() - start.getMonth()

    let totalMonths = yearDiff * 12 + monthDiff

    // 日にちを考慮
    // 例: 起点日が15日の場合、毎月15日に1ヶ月加算
    if (today.getDate() < start.getDate()) {
        totalMonths -= 1
    }

    return Math.max(0, totalMonths) // 負の値は0にする
}

/**
 * 違約金計算結果のインターフェース
 */
export interface CancellationFeeInfo {
    monthsElapsed: number        // 経過月数
    remainingMonths: number      // 残月数
    cancellationFee: number      // 違約金額
    isPastMinimumPeriod: boolean // 最低利用期間終了済みか
    minimumPeriodEndDate: Date   // 最低利用期間終了日
}

/**
 * 違約金を計算
 * 
 * @param contractStartDate - 契約起点日
 * @param currentPlanPrice - 現在のプラン月額
 * @returns 違約金情報オブジェクト
 */
export function calculateCancellationFee(
    contractStartDate: Date | string,
    currentPlanPrice: number
): CancellationFeeInfo {
    const MINIMUM_MONTHS = 6

    // 日付型に変換
    const startDateObj = new Date(contractStartDate)

    const monthsElapsed = calculateMonthsElapsed(startDateObj)
    const remainingMonths = Math.max(0, MINIMUM_MONTHS - monthsElapsed)

    // 最低利用期間終了日を計算
    const minimumPeriodEndDate = new Date(startDateObj)
    minimumPeriodEndDate.setMonth(minimumPeriodEndDate.getMonth() + MINIMUM_MONTHS)

    if (remainingMonths === 0) {
        // 6ヶ月経過済み → 違約金なし
        return {
            monthsElapsed,
            remainingMonths: 0,
            cancellationFee: 0,
            isPastMinimumPeriod: true,
            minimumPeriodEndDate
        }
    }

    // 違約金 = 現在のプラン月額 × 残月数
    const cancellationFee = currentPlanPrice * remainingMonths

    return {
        monthsElapsed,
        remainingMonths,
        cancellationFee,
        isPastMinimumPeriod: false,
        minimumPeriodEndDate
    }
}

/**
 * プラン情報の定義
 * 環境変数からPrice IDを取得
 */
export const PLAN_CONFIG = {
    basic: {
        id: 'basic',
        name: 'ベーシックプラン',
        price: 10000,
        // 環境変数が未設定の場合は空文字（実装時は.env.localを確認すること）
        // 環境変数が未設定の場合は空文字（実装時は.env.localを確認すること）
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC || 'price_1S2NQ5GRAknvvgNGhYaGgo1k',
        features: [
            'システムダウンロード権限',
            '初期セットアップマニュアル',
            'AIチャットサポート',
            '自己設置（セルフサポート）'
        ]
    },
    premium: { // 内部IDはpremiumだが表示はプロフェッショナル（仕様書準拠）
        // ※注意：ビジネス上の名前定義とコード上のID定義のマッピングに注意
        // ここでは仕様書の "premium" (¥50,000) を professional として扱うか、IDを premium とするかの決定が必要
        // 今回は既存コードに合わせて Professionalプラン = ID: professional, Premiumプラン = ID: premium とする
        id: 'professional',
        name: 'プロフェッショナルプラン',
        price: 50000,
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL || 'price_1S8GtIGRAknvvgNGVd4bXIbF',
        features: [
            'システムダウンロード権限',
            '月3システムまで設置代行',
            'コーディング代行サービス',
            '月1回無料ミーティング',
            '優先技術サポート'
        ]
    }
} as const

export type PlanId = 'basic' | 'professional' | 'premium' // 既存コードとの互換性のためpremiumも含める

/**
 * 日付を日本語表記にフォーマット
 */
export function formatDateJP(date: Date | string): string {
    const d = new Date(date)
    return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(d)
}

/**
 * 金額を日本円表記にフォーマット
 */
export function formatCurrencyJP(amount: number): string {
    return new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY'
    }).format(amount)
}
