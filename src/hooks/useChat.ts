import { useCallback, useEffect, useRef } from 'react'
import { useChatStore } from '../store/chatStore'
import type { ChatMessage } from '../types'

function createId(prefix: string): string {
  if ('randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function useChat(): {
  sendMessage: (message: string) => Promise<void>
} {
  const streamMap = useRef(new Map<string, string>())

  const addMessage = useChatStore((state) => state.addMessage)
  const lastScreenshot = useChatStore((state) => state.lastScreenshot)
  const setStreaming = useChatStore((state) => state.setStreaming)

  useEffect(() => {
    const unsubscribeToken = window.screenMind.onToken(({ streamId, token }) => {
      const assistantId = streamMap.current.get(streamId)

      if (streamId && assistantId) {
        useChatStore.getState().appendToMessage(assistantId, token)
      }
    })

    const unsubscribeDone = window.screenMind.onStreamDone(({ streamId }) => {
      const assistantId = streamMap.current.get(streamId)

      if (streamId && assistantId) {
        useChatStore.getState().updateMessage(assistantId, { status: 'done' })
        streamMap.current.delete(streamId)
      }

      useChatStore.getState().setStreaming(streamMap.current.size > 0)
    })

    const unsubscribeError = window.screenMind.onChatError(({ streamId, message }) => {
      const assistantId = streamId ? streamMap.current.get(streamId) : undefined

      if (streamId && assistantId) {
        useChatStore.getState().updateMessage(assistantId, {
          content: message,
          status: 'error'
        })
        streamMap.current.delete(streamId)
        useChatStore.getState().setStreaming(streamMap.current.size > 0)
        return
      }

      useChatStore.getState().addMessage({
        id: createId('error'),
        role: 'assistant',
        content: message,
        createdAt: Date.now(),
        status: 'error'
      })
      useChatStore.getState().setStreaming(false)
    })

    return () => {
      unsubscribeToken()
      unsubscribeDone()
      unsubscribeError()
    }
  }, [])

  const sendMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim()

      if (!trimmed) {
        return
      }

      const assistantId = createId('assistant')
      const userMessage: ChatMessage = {
        id: createId('user'),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
        status: 'done'
      }

      addMessage(userMessage)
      addMessage({
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        status: 'streaming'
      })
      setStreaming(true)

      try {
        const history = useChatStore
          .getState()
          .messages.slice(-6)
          .map(({ role, content }) => ({ role, content }))

        const { streamId } = await window.screenMind.sendMessage({
          message: trimmed,
          imageBase64: lastScreenshot?.base64,
          history
        })

        streamMap.current.set(streamId, assistantId)
      } catch (error) {
        const fallback =
          error instanceof Error ? error.message : 'Nao consegui enviar a mensagem agora.'
        useChatStore.getState().updateMessage(assistantId, {
          content: fallback,
          status: 'error'
        })
        setStreaming(false)
      }
    },
    [addMessage, lastScreenshot, setStreaming]
  )

  return { sendMessage }
}
