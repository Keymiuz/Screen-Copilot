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
  attachments?: InlineAttachment[]
  history: ChatHistoryMessage[]
  useGoogleSearch?: boolean
}

interface GeminiPart {
  text?: string
  inlineData?: {
    mimeType: string
    data: string
  }
  fileData?: {
    mimeType: string
    fileUri: string
  }
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

export interface InlineAttachment {
  mimeType: string
  data?: string
  fileUri?: string
}

interface GroundingChunk {
  web?: {
    uri?: string
    title?: string
  }
}

interface GeminiResponseChunk {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
    groundingMetadata?: {
      groundingChunks?: GroundingChunk[]
      webSearchQueries?: string[]
    }
  }>
}

const SCREENMIND_SYSTEM_PROMPT = `Voce e o ScreenMind, um assistente de IA que ve a tela do usuario em tempo real.

Regras:
- Responda sempre em portugues brasileiro.
- Seja direto e objetivo. Sem introducoes longas.
- Analise o conteudo visual anexado com precisao.
- Se nao conseguir ver algo claramente, diga isso explicitamente.
- Nao invente informacoes que nao estejam visiveis na tela.
- Quando Google Search estiver habilitado, use resultados atuais da web para precos, noticias e informacoes recentes.
- Quando usar informacoes da web, inclua links de fontes relevantes no final.
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

  for (const attachment of input.attachments ?? []) {
    if (attachment.fileUri) {
      currentParts.push({
        fileData: {
          mimeType: attachment.mimeType,
          fileUri: attachment.fileUri
        }
      })
      continue
    }

    if (attachment.data) {
      currentParts.push({
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.data
        }
      })
    }
  }

  currentParts.push({ text: input.userMessage })
  contents.push({ role: 'user', parts: currentParts })

  return contents
}

function extractGeminiErrorMessage(body: string): string {
  if (!body) {
    return ''
  }

  try {
    const parsed = JSON.parse(body) as {
      error?: {
        message?: string
      }
    }

    return parsed.error?.message?.trim() ?? ''
  } catch {
    return body.trim()
  }
}

function extractResponseChunk(data: string): {
  text: string
  sources: GroundingChunk[]
  searchQueries: string[]
} {
  const parsed = JSON.parse(data) as GeminiResponseChunk
  const candidates = parsed.candidates ?? []

  return {
    text:
      candidates
        .flatMap((candidate) => candidate.content?.parts ?? [])
        .map((part) => part.text ?? '')
        .join('') ?? '',
    sources: candidates.flatMap((candidate) => candidate.groundingMetadata?.groundingChunks ?? []),
    searchQueries: candidates.flatMap(
      (candidate) => candidate.groundingMetadata?.webSearchQueries ?? []
    )
  }
}

function formatGroundingSources(sources: GroundingChunk[]): string {
  const uniqueSources = new Map<string, string>()

  for (const source of sources) {
    const uri = source.web?.uri?.trim()

    if (!uri || uniqueSources.has(uri)) {
      continue
    }

    uniqueSources.set(uri, source.web?.title?.trim() || uri)
  }

  if (uniqueSources.size === 0) {
    return ''
  }

  const lines = Array.from(uniqueSources.entries())
    .slice(0, 5)
    .map(([uri, title], index) => `${index + 1}. [${title}](${uri})`)

  return `\n\nFontes:\n${lines.join('\n')}`
}

function toFriendlyHttpError(status: number, body: string): string {
  const apiMessage = extractGeminiErrorMessage(body)

  if (status === 400) {
    return apiMessage
      ? `A chamada para o Gemini foi rejeitada: ${apiMessage}`
      : 'A chamada para o Gemini foi rejeitada. Verifique se a chave, o modelo e a URL estao corretos.'
  }

  if (status === 401 || status === 403) {
    return 'Chave do Google/Gemini invalida ou sem permissao para este modelo.'
  }

  if (status === 429) {
    return 'Limite de uso do Gemini atingido. Tente novamente em alguns minutos.'
  }

  return `O Gemini retornou erro ${status}${apiMessage ? `: ${apiMessage}` : body ? `: ${body.slice(0, 240)}` : '.'}`
}

export async function* streamGeminiQuery(input: StreamGeminiQueryInput): AsyncGenerator<string> {
  const { settings } = input

  if (!settings.googleApiKey.trim()) {
    throw new Error('Adicione sua chave do Google/Gemini em Configuracoes antes de enviar mensagens.')
  }

  const endpoint = `${normalizeBaseUrl(settings.googleBaseUrl)}/v1beta/models/${encodeURIComponent(
    settings.googleModel
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(settings.googleApiKey)}`

  const body: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: SCREENMIND_SYSTEM_PROMPT }]
    },
    contents: buildContents(input),
    generationConfig: {
      temperature: input.useGoogleSearch ? 0.25 : 0.4,
      topP: 0.95,
      maxOutputTokens: 1536
    }
  }

  if (input.useGoogleSearch) {
    body.tools = [{ google_search: {} }]
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
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
  const groundingSources: GroundingChunk[] = []

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

        const chunk = extractResponseChunk(data)
        groundingSources.push(...chunk.sources)
        const token = chunk.text

        if (token) {
          yield token
        }
      }
    }
  }

  if (input.useGoogleSearch) {
    const formattedSources = formatGroundingSources(groundingSources)

    if (formattedSources) {
      yield formattedSources
    }
  }
}
