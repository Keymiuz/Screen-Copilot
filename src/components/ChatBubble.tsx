import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { ChatMessage } from '../types'

function LoadingDots(): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Respondendo">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-zinc-300"
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
    </span>
  )
}

export function ChatBubble({ message }: { message: ChatMessage }): JSX.Element {
  const isUser = message.role === 'user'
  const isError = message.status === 'error'
  const isEmptyStreaming = message.status === 'streaming' && !message.content
  const [copied, setCopied] = useState(false)

  async function handleCopy(): Promise<void> {
    await window.screenMind.copyText(message.content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'relative max-w-[84%] rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm',
          !isUser && message.content ? 'pr-10' : '',
          isUser ? 'bg-cyan-500 text-zinc-950' : 'bg-white/10 text-zinc-100',
          isError ? 'border border-rose-400/40 bg-rose-500/20 text-rose-50' : ''
        ].join(' ')}
      >
        {!isUser && message.content ? (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="app-region-no-drag absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-cyan-200"
            title={copied ? 'Copiado' : 'Copiar resposta'}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        ) : null}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : isEmptyStreaming ? (
          <LoadingDots />
        ) : (
          <div className="markdown-response">
            <ReactMarkdown>{message.content}</ReactMarkdown>
            {message.status === 'streaming' ? <LoadingDots /> : null}
          </div>
        )}
      </div>
    </div>
  )
}

function CopyIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 15H4a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CheckIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
