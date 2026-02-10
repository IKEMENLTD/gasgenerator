'use client'

import { useEffect } from 'react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // エラーをコンソールに出力
        console.error(error)
    }, [error])

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-50">
            <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full border border-red-200">
                <h2 className="text-2xl font-bold text-red-600 mb-4">エラーが発生しました</h2>
                <div className="bg-gray-100 p-4 rounded mb-6 overflow-auto max-h-48 text-left">
                    <p className="font-mono text-sm text-gray-800 break-words">
                        {error.message || '不明なエラーが発生しました'}
                    </p>
                    {error.digest && (
                        <p className="font-mono text-xs text-gray-500 mt-2">
                            Digest: {error.digest}
                        </p>
                    )}
                </div>
                <button
                    onClick={() => reset()}
                    className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition-colors font-bold"
                >
                    もう一度試す
                </button>
            </div>
        </div>
    )
}
