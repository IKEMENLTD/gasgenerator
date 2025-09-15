/**
 * 404エラーページ
 */

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          コードが見つかりません
        </h1>
        <p className="text-gray-600 mb-6">
          指定されたコードは存在しないか、削除された可能性があります。
        </p>
        <Link
          href="/"
          className="inline-block bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-blue-700 transition duration-200"
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  )
}