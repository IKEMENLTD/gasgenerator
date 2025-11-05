'use client'

import { useState, useEffect, useRef } from 'react'
import ChatBubble from './components/ChatBubble'
import TypingIndicator from './components/TypingIndicator'
import CodeBlock from './components/CodeBlock'
import ScenarioButton from './components/ScenarioButton'
import ImpactCounter from './components/ImpactCounter'
import ChartIcon from './components/icons/ChartIcon'
import BoxIcon from './components/icons/BoxIcon'
import MailIcon from './components/icons/MailIcon'
import LogoIcon from './components/icons/LogoIcon'
import { scenarios, ScenarioId } from './scenarios'
import { Message } from './scenarios/types'

type ConversationState = 'initial' | 'thinking' | 'responding' | 'generating' | 'complete'

export default function DemoPage() {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [state, setState] = useState<ConversationState>('initial')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, state])

  useEffect(() => {
    // 初期メッセージ
    setMessages([
      {
        id: '1',
        text: 'こんにちは！TaskMateです。\nどんな業務を自動化したいですか？\n\n以下から選択してください：',
        isUser: false,
        timestamp: getCurrentTime()
      }
    ])
  }, [])

  const getCurrentTime = () => {
    const now = new Date()
    return `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
  }

  const handleScenarioSelect = async (scenarioId: ScenarioId) => {
    setSelectedScenario(scenarioId)
    const scenario = scenarios[scenarioId]

    // ユーザーメッセージ
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: scenario.userRequest,
      isUser: true,
      timestamp: getCurrentTime()
    }
    setMessages(prev => [...prev, userMessage])

    // タイピング表示
    setState('thinking')
    await sleep(1500)

    // AI応答
    setState('responding')
    const aiMessage: Message = {
      id: `ai-${Date.now()}`,
      text: scenario.aiResponse,
      isUser: false,
      timestamp: getCurrentTime()
    }
    setMessages(prev => [...prev, aiMessage])

    // コード生成中
    setState('generating')
    await sleep(2000)

    // 完成
    setState('complete')
  }

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const scenario = selectedScenario ? scenarios[selectedScenario] : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">TaskMate デモ体験</h1>
              <p className="text-sm text-gray-600 mt-1">プログラミング不要のGAS自動生成</p>
            </div>
            <a
              href="https://taskmateai.net/"
              className="hidden md:block bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              無料で始める
            </a>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* チャットエリア */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              {/* チャットヘッダー */}
              <div className="bg-emerald-500 text-white px-6 py-4 rounded-t-xl">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center">
                    <LogoIcon className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="font-semibold">TaskMate AI</h2>
                    <p className="text-sm text-emerald-100">オンライン</p>
                  </div>
                </div>
              </div>

              {/* メッセージエリア */}
              <div className="h-[600px] overflow-y-auto p-6 bg-gray-50">
                {messages.map(message => (
                  <ChatBubble
                    key={message.id}
                    message={message.text}
                    isUser={message.isUser}
                    timestamp={message.timestamp}
                  />
                ))}

                {/* シナリオ選択ボタン */}
                {state === 'initial' && (
                  <div className="space-y-3 mt-4">
                    <ScenarioButton
                      icon={<ChartIcon />}
                      title="売上データの自動集計"
                      description="Googleフォームから売上を自動集計"
                      onClick={() => handleScenarioSelect('salesAggregation')}
                    />
                    <ScenarioButton
                      icon={<BoxIcon />}
                      title="在庫アラート通知"
                      description="在庫不足をSlackで自動通知"
                      onClick={() => handleScenarioSelect('inventoryAlert')}
                    />
                    <ScenarioButton
                      icon={<MailIcon />}
                      title="週次レポート自動送信"
                      description="毎週金曜に週次レポートをメール送信"
                      onClick={() => handleScenarioSelect('weeklyReport')}
                    />
                  </div>
                )}

                {/* タイピングインジケーター */}
                {(state === 'thinking' || state === 'generating') && <TypingIndicator />}

                {/* コード表示 */}
                {state === 'complete' && scenario && (
                  <div className="mt-4">
                    <div className="bg-white rounded-lg p-4 mb-4 border-l-4 border-emerald-500">
                      <p className="font-semibold text-emerald-600 mb-2">✓ 完成しました！</p>
                      <p className="text-sm text-gray-700">
                        以下のコードをGoogleスプレッドシートの「拡張機能 → Apps Script」に貼り付けるだけで動作します。
                      </p>
                    </div>

                    <CodeBlock code={scenario.code} language="javascript" />

                    <div className="bg-blue-50 rounded-lg p-4 mt-4">
                      <h3 className="font-semibold text-blue-900 mb-2">セットアップ手順</h3>
                      <div className="text-sm text-blue-800 whitespace-pre-line">
                        {scenario.setupInstructions}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 mt-6">
                      <a
                        href="https://taskmateai.net/"
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                      >
                        今すぐ無料で始める
                      </a>
                      <a
                        href="https://timerex.net/s/cz1917903_47c5/7caf7949"
                        className="flex-1 bg-white hover:bg-gray-50 text-emerald-600 font-semibold py-3 px-6 rounded-lg text-center border-2 border-emerald-500 transition-colors"
                      >
                        無料相談を予約
                      </a>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedScenario(null)
                        setMessages([
                          {
                            id: '1',
                            text: 'こんにちは！TaskMateです。\nどんな業務を自動化したいですか？\n\n以下から選択してください：',
                            isUser: false,
                            timestamp: getCurrentTime()
                          }
                        ])
                        setState('initial')
                      }}
                      className="w-full mt-4 text-gray-600 hover:text-gray-900 font-medium py-2 transition-colors"
                    >
                      別のシナリオを試す
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          {/* サイドバー - 削減効果 */}
          <div className="lg:col-span-1">
            {scenario ? (
              <ImpactCounter
                timeSaved={scenario.timeSaved}
                costSaved={scenario.costSaved}
                errorReduction={scenario.errorReduction}
              />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-bold text-lg mb-4 text-gray-900">TaskMateとは？</h3>
                <div className="space-y-4 text-sm text-gray-700">
                  <p>
                    TaskMateは、LINEで日本語指示を送るだけでGoogle Apps Script（GAS）を自動生成するAIサービスです。
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 mt-1">✓</span>
                      <span>プログラミング知識一切不要</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 mt-1">✓</span>
                      <span>LINEで「○○したい」と送るだけ</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 mt-1">✓</span>
                      <span>データ集計、在庫管理など幅広く対応</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 mt-1">✓</span>
                      <span>月額1万円から利用可能</span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <p className="font-semibold text-gray-900 mb-2">導入実績</p>
                    <p className="text-gray-600">平均月40時間の業務時間削減を実現</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* フッター */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-sm text-gray-600">
            <p>© 2025 TaskMate. All rights reserved.</p>
            <div className="mt-2 space-x-4">
              <a href="/terms" className="hover:text-emerald-600 transition-colors">
                利用規約
              </a>
              <a href="/privacy" className="hover:text-emerald-600 transition-colors">
                プライバシーポリシー
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
