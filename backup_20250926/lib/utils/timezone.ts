/**
 * タイムゾーン処理ユーティリティ
 * 日本時間（JST）での処理を統一的に扱う
 */

export class TimeZoneUtil {
  private static readonly JST_OFFSET = 9 * 60 * 60 * 1000 // 9時間のミリ秒

  /**
   * 現在時刻を日本時間で取得
   */
  static nowJST(): Date {
    const now = new Date()
    return new Date(now.getTime() + this.JST_OFFSET)
  }

  /**
   * 日本時間のISO文字列を取得
   */
  static nowJSTString(): string {
    return this.nowJST().toISOString()
  }

  /**
   * 日本時間の日付文字列を取得（YYYY-MM-DD形式）
   */
  static todayJST(): string {
    const jst = this.nowJST()
    return jst.toISOString().split('T')[0]
  }

  /**
   * 月初を日本時間で取得
   */
  static startOfMonthJST(): Date {
    const jst = this.nowJST()
    return new Date(jst.getFullYear(), jst.getMonth(), 1)
  }

  /**
   * 月末を日本時間で取得
   */
  static endOfMonthJST(): Date {
    const jst = this.nowJST()
    return new Date(jst.getFullYear(), jst.getMonth() + 1, 0, 23, 59, 59, 999)
  }

  /**
   * UTC時刻を日本時間に変換
   */
  static toJST(date: Date | string): Date {
    const d = typeof date === 'string' ? new Date(date) : date
    return new Date(d.getTime() + this.JST_OFFSET)
  }

  /**
   * 日本時間をUTCに変換
   */
  static fromJST(date: Date): Date {
    return new Date(date.getTime() - this.JST_OFFSET)
  }

  /**
   * タイムスタンプの比較（日本時間基準）
   */
  static isSameMonthJST(date1: Date | string, date2: Date | string): boolean {
    const d1 = this.toJST(date1)
    const d2 = this.toJST(date2)
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()
  }

  /**
   * 日付の差分を日数で取得
   */
  static daysDiff(date1: Date | string, date2: Date | string): number {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2
    const diff = Math.abs(d1.getTime() - d2.getTime())
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }
}