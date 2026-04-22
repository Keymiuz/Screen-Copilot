interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

interface GoogleSettings {
  googleApiKey: string
  googleBaseUrl: string
  googleModel: string
}

interface StreamGeminiQueryInput {
  settings: GoogleSettings
  userMessage: string
  imageBase64?: string
  history: ChatHistoryMessage[]
}

interface GeminiPart {
  text?: string
  inlineData?: {
    mimeType: string
    data: string
  }
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

const SCREENMIND_SYSTEM_PROMPT = `Voce e o ScreenMind, um assistente de IA que ve a tela do usuario em tempo real.

Regras:
- Responda sempre em portugues brasileiro.
- Seja direto e objetivo. Sem introducoes longas.
- Analise o conteudo visual anexado com precisao.
- Se nao conseguir ver algo claramente, diga isso explicitamente.
- Nao invente informacoes que nao estejam visiveis na tela.
- Para codigo: use blocos de codigo com a linguagem correta.
- Maximo de 300 palavras por resposta, a menos que seja codigo.`

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function buildContents(input: StreamGeminiQueryInput): GeminiContent[] {
  const contents: GeminiContent[] = input.history.slice(-6).map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }]
  }))

  const currentParts: GeminiPart[] = []

  if (input.imageBase64) {
    currentParts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: input.imageBase64
      }
    })
  }

  currentParts.push({ text: input.userMessage })
  contents.push({ role: 'user', parts: currentParts })

  return contents
}

function extractContentFromSseData(data: string): string {
  const parsed = JSON.parse(data) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string
        }>
      }
    }>
  }

  return parsed.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
}

function toFriendlyHttpError(status: number, body: string): string {
  if (status === 400) {
    return 'A chamada para o Gemini foi rejeitada. Verifique se a chave e o modelo estao corretos.'
  }

  if (status === 401 || status === 403) {
    return 'Chave do Google/Gemini invalida ou sem permissao para este modelo.'
  }

  if (status === 429) {
    return 'Limite de uso do Gemini atingido. Tente novamente em alguns minutos.'
  }

  return `O Gemini retornou erro ${status}${body ? `: ${body.slice(0, 240)}` : '.'}`
}

export async function* streamGeminiQuery(input: StreamGeminiQueryInput): AsyncGenerator<string> {
  const { settings } = input

  if (!settings.googleApiKey.trim()) {
    throw new Error('Adicione sua chave do Google/Gemini em Configuracoes antes de enviar mensagens.')
  }

  const endpoint = `${normalizeBaseUrl(settings.googleBaseUrl)}/v1beta/models/${encodeURIComponent(
    settings.googleModel
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(settings.googleApiKey)}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SCREENMIND_SYSTEM_PROMPT }]
      },
      contents: buildContents(input),
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        maxOutputTokens: 1024
      }
    })
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(toFriendlyHttpError(response.status, body))
  }

  if (!response.body) {
    throw new Error('O Gemini nao retornou um stream de resposta.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() ?? ''

    for (const event of events) {
      for (const line of event.split(/\r?\n/)) {
        if (!line.startsWith('data:')) {
          continue
        }

        const data = line.slice(5).trim()

        if (!data) {
          continue
        }

        const token = extractContentFromSseData(data)

        if (token) {
          yield token
        }
      }
    }
  }
}
