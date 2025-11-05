'use client'

interface ChatBubbleProps {
  message: string
  isUser?: boolean
  timestamp?: string
}

export default function ChatBubble({ message, isUser = false, timestamp }: ChatBubbleProps) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-emerald-500 text-white rounded-tr-sm'
              : 'bg-gray-100 text-gray-900 rounded-tl-sm'
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
        </div>
        {timestamp && (
          <p className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {timestamp}
          </p>
        )}
      </div>
    </div>
  )
}
