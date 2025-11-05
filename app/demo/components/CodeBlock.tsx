'use client'

import { useState } from 'react'
import CopyIcon from './icons/CopyIcon'
import CheckIcon from './icons/CheckIcon'

interface CodeBlockProps {
  code: string
  language?: string
}

export default function CodeBlock({ code, language = 'javascript' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white">
        <span className="text-xs font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-xs hover:text-emerald-400 transition-colors"
        >
          {copied ? (
            <>
              <CheckIcon className="w-4 h-4" />
              コピーしました
            </>
          ) : (
            <>
              <CopyIcon className="w-4 h-4" />
              コピー
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm">
        <code className="font-mono text-gray-800">{code}</code>
      </pre>
    </div>
  )
}
