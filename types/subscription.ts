export interface SubscriptionDetails {
    planId: string
    planName: string
    status: string
    contractStartDate: string
    rawStartDate?: string // 計算用のISO日付文字列
    price: number
    monthsElapsed: number
    contractEndDate: string // 6ヶ月縛りの終了日
    isContractFulfilled: boolean
    nextBillingDate?: string
}
