/**
 * Supabaseクエリの型ガード
 */

/**
 * エラーレスポンスかどうかを判定
 */
export function isSupabaseError(
  result: any
): result is { data: null; error: Error } {
  return result?.error !== undefined && result?.data === null
}

/**
 * 成功レスポンスかどうかを判定
 */
export function isSupabaseSuccess<T>(
  result: any
): result is { data: T; error: null } {
  return result?.error === null && result?.data !== undefined
}

/**
 * クエリ結果をチェックし、エラーの場合は例外を投げる
 */
export function checkSupabaseError<T>(
  result: { data: T | null; error: Error | null },
  context?: string
): T {
  if (result.error) {
    throw new Error(
      context 
        ? `${context}: ${result.error.message}` 
        : result.error.message
    )
  }
  return result.data as T
}