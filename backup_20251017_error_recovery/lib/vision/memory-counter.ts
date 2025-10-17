/**
 * メモリ内使用量カウンター
 * Supabaseが利用できない場合のフォールバック用
 */
export class MemoryUsageCounter {
  private static instance: MemoryUsageCounter
  private counter: Map<string, number> = new Map()
  
  private constructor() {}
  
  static getInstance(): MemoryUsageCounter {
    if (!MemoryUsageCounter.instance) {
      MemoryUsageCounter.instance = new MemoryUsageCounter()
    }
    return MemoryUsageCounter.instance
  }
  
  /**
   * 使用回数を取得
   */
  get(key: string): number {
    return this.counter.get(key) || 0
  }
  
  /**
   * 使用回数を設定
   */
  set(key: string, value: number): void {
    this.counter.set(key, value)
  }
  
  /**
   * 使用回数をインクリメント
   */
  increment(key: string): number {
    const current = this.get(key)
    const newValue = current + 1
    this.set(key, newValue)
    return newValue
  }
  
  /**
   * 古いキーをクリーンアップ
   */
  cleanup(daysToKeep: number = 7): void {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysToKeep)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    
    for (const key of this.counter.keys()) {
      // キー形式: userId_YYYY-MM-DD
      const dateStr = key.split('_').pop()
      if (dateStr && dateStr < cutoffStr) {
        this.counter.delete(key)
      }
    }
  }
  
  /**
   * すべてクリア
   */
  clear(): void {
    this.counter.clear()
  }
  
  /**
   * サイズを取得
   */
  size(): number {
    return this.counter.size
  }
}