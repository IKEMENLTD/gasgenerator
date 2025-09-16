/**
 * コード共有表示ページ
 * /s/[id] でアクセス
 */

import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import CodeViewer from './CodeViewerNew'

interface PageProps {
  params: {
    id: string
  }
}

// メタデータ生成（動的OGP対応）
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://gasgenerator.onrender.com'
    const response = await fetch(`${baseUrl}/api/share/${params.id}`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      return {
        title: 'コードが見つかりません - GAS Generator',
        description: '指定されたコードは存在しないか、有効期限が切れています。'
      }
    }

    const data = await response.json()

    return {
      title: `${data.data.title} - GAS Generator`,
      description: data.data.description || 'Google Apps Scriptの自動生成コード',
      openGraph: {
        title: data.data.title,
        description: data.data.description || 'Google Apps Scriptの自動生成コード',
        type: 'article',
        url: `${baseUrl}/s/${params.id}`,
        siteName: 'GAS Generator'
      }
    }
  } catch (error) {
    console.error('Failed to generate metadata:', error)
    return {
      title: 'GAS Generator',
      description: 'Google Apps Scriptコード共有'
    }
  }
}

export default async function SharePage({ params }: PageProps) {
  const { id } = params

  // 短縮IDのバリデーション
  if (!id || id.length !== 8) {
    notFound()
  }

  // サーバーサイドでコードデータを取得
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://gasgenerator.onrender.com'
    const headersList = headers()
    const password = headersList.get('x-password')

    const response = await fetch(`${baseUrl}/api/share/${id}`, {
      cache: 'no-store',
      headers: password ? {
        'x-password': password
      } : {}
    })

    if (!response.ok) {
      const errorData = await response.json()

      // エラーに応じた表示
      if (errorData.errorCode === 'SHARE_NOT_FOUND') {
        notFound()
      }

      if (errorData.errorCode === 'SHARE_EXPIRED') {
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="text-6xl mb-4">⏰</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                有効期限切れ
              </h1>
              <p className="text-gray-600">
                このコードの共有期限が切れています。<br />
                コードの作成者に新しいリンクをリクエストしてください。
              </p>
            </div>
          </div>
        )
      }

      if (errorData.errorCode === 'PASSWORD_REQUIRED') {
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
              <div className="text-6xl mb-4 text-center">🔒</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                パスワード保護
              </h1>
              <form action={`/s/${id}`} method="GET">
                <input
                  type="password"
                  name="password"
                  placeholder="パスワードを入力"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <button
                  type="submit"
                  className="w-full mt-4 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200"
                >
                  表示
                </button>
              </form>
            </div>
          </div>
        )
      }

      if (errorData.errorCode === 'MAX_VIEWS_REACHED') {
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="text-6xl mb-4">👀</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                閲覧回数上限
              </h1>
              <p className="text-gray-600">
                このコードは最大閲覧回数に達しました。
              </p>
            </div>
          </div>
        )
      }

      throw new Error(errorData.error)
    }

    const shareData = await response.json()

    // クライアントコンポーネントに渡す
    return <CodeViewer shareId={id} initialData={shareData.data} />

  } catch (error) {
    console.error('Failed to load share:', error)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            エラーが発生しました
          </h1>
          <p className="text-gray-600">
            コードの読み込み中にエラーが発生しました。<br />
            しばらく待ってから再度お試しください。
          </p>
        </div>
      </div>
    )
  }
}