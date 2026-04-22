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

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[84%] rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm',
          isUser ? 'bg-cyan-500 text-zinc-950' : 'bg-white/10 text-zinc-100',
          isError ? 'border border-rose-400/40 bg-rose-500/20 text-rose-50' : ''
        ].join(' ')}
      >
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
