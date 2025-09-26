'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode'

interface TrackingLink {
  id: string
  code: string
  source: string
  campaign_name: string
  created_at: string
  created_by: string
  click_count: number
  friend_count: number
  is_active: boolean
}

export default function TrackingAdminPage() {
  const [links, setLinks] = useState<TrackingLink[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newLink, setNewLink] = useState({
    source: '',
    campaign_name: '',
    created_by: 'admin@taskmate.ai'
  })
  const [qrCodes, setQrCodes] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    fetchLinks()
  }, [])

  const fetchLinks = async () => {
    try {
      const response = await fetch('/api/admin/tracking-links')
      const data = await response.json()
      setLinks(data.data || [])
      generateQRCodes(data.data || [])
    } catch (error) {
      console.error('Failed to fetch links:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateQRCodes = async (links: TrackingLink[]) => {
    const codes: { [key: string]: string } = {}
    for (const link of links) {
      const url = `https://taskmateai.net/t/${link.code}`
      codes[link.id] = await QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
    }
    setQrCodes(codes)
  }

  const createLink = async () => {
    try {
      const response = await fetch('/api/admin/tracking-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newLink)
      })
      const data = await response.json()
      if (data.data) {
        await fetchLinks()
        setShowCreateModal(false)
        setNewLink({
          source: '',
          campaign_name: '',
          created_by: 'admin@taskmate.ai'
        })
      }
    } catch (error) {
      console.error('Failed to create link:', error)
    }
  }

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await fetch('/api/admin/tracking-links', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id,
          is_active: !currentStatus
        })
      })
      await fetchLinks()
    } catch (error) {
      console.error('Failed to update link:', error)
    }
  }

  const deleteLink = async (id: string) => {
    if (!confirm('このトラッキングリンクを削除しますか？')) return

    try {
      await fetch(`/api/admin/tracking-links?id=${id}`, {
        method: 'DELETE'
      })
      await fetchLinks()
    } catch (error) {
      console.error('Failed to delete link:', error)
    }
  }

  const exportSessions = async (linkId?: string) => {
    const url = linkId
      ? `/api/admin/sessions?linkId=${linkId}&export=csv`
      : '/api/admin/sessions?export=csv'

    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              トラッキングリンク管理
            </h1>
            <div className="space-x-3">
              <button
                onClick={() => exportSessions()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                全データCSV出力
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                新規作成
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    キャンペーン
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ソース
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    コード
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    URL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    クリック数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    友達追加数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CV率
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    QR
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状態
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {links.map((link) => {
                  const cvRate = link.click_count > 0
                    ? ((link.friend_count / link.click_count) * 100).toFixed(1)
                    : '0'

                  return (
                    <tr key={link.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {link.campaign_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                          {link.source}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {link.code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={`https://taskmateai.net/t/${link.code}`}
                            readOnly
                            className="text-xs px-2 py-1 border rounded w-48"
                          />
                          <button
                            onClick={() => navigator.clipboard.writeText(`https://taskmateai.net/t/${link.code}`)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            📋
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {link.click_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {link.friend_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {cvRate}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {qrCodes[link.id] && (
                          <img
                            src={qrCodes[link.id]}
                            alt="QR Code"
                            className="w-12 h-12 cursor-pointer"
                            onClick={() => {
                              const w = window.open('', '_blank')
                              w?.document.write(`<img src="${qrCodes[link.id]}" />`)
                            }}
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => toggleActive(link.id, link.is_active)}
                          className={`px-2 py-1 text-xs rounded-full ${
                            link.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {link.is_active ? '有効' : '無効'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => exportSessions(link.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            CSV
                          </button>
                          <button
                            onClick={() => deleteLink(link.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">新規トラッキングリンク作成</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  キャンペーン名
                </label>
                <input
                  type="text"
                  value={newLink.campaign_name}
                  onChange={(e) => setNewLink({ ...newLink, campaign_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="例: 2024年春のキャンペーン"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ソース
                </label>
                <select
                  value={newLink.source}
                  onChange={(e) => setNewLink({ ...newLink, source: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="">選択してください</option>
                  <option value="Twitter">Twitter</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Blog">Blog</option>
                  <option value="Email">Email</option>
                  <option value="YouTube">YouTube</option>
                  <option value="TikTok">TikTok</option>
                  <option value="Other">その他</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={createLink}
                disabled={!newLink.campaign_name || !newLink.source}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}