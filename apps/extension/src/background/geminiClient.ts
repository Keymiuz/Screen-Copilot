interface GeminiConfig {
  apiKey: string
  model: string
}

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)

  if (!match) {
    throw new Error('Audio chunk invalido.')
  }

  return {
    mimeType: match[1],
    data: match[2]
  }
}

function toFriendlyError(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return 'Chave do Google/Gemini invalida ou sem permissao para este modelo.'
  }

  if (status === 429) {
    return 'Limite de uso do Gemini atingido. Tente novamente em alguns minutos.'
  }

  return `Gemini retornou erro ${status}${body ? `: ${body.slice(0, 180)}` : '.'}`
}

async function callGemini(config: GeminiConfig, body: unknown): Promise<string> {
  if (!config.apiKey.trim()) {
    throw new Error('Adicione sua Google API key nas configuracoes do MindSide.')
  }

  const endpoint = `${GEMINI_BASE_URL}/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(
    config.apiKey
  )}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '')
    throw new Error(toFriendlyError(response.status, bodyText))
  }

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string
        }>
      }
    }>
  }

  return json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')?.trim() ?? ''
}

export async function transcribeAudioChunk(config: GeminiConfig, dataUrl: string): Promise<string> {
  const audio = parseDataUrl(dataUrl)

  return callGemini(config, {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              'Transcreva este trecho de audio de uma reuniao em portugues brasileiro. ' +
              'Retorne apenas a fala limpa. Se nao houver fala inteligivel, retorne uma string vazia.'
          },
          {
            inlineData: {
              mimeType: audio.mimeType,
              data: audio.data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 768
    }
  })
}

export async function summarizeTranscript(config: GeminiConfig, transcript: string): Promise<string> {
  return callGemini(config, {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Gere um resumo conciso em markdown desta reuniao em portugues brasileiro.

Inclua exatamente estas secoes:
## Resumo
## Decisoes
## Action items
## Perguntas em aberto
## Notas

Se uma secao nao tiver informacao suficiente, escreva "- Nao identificado".

Transcricao:
${transcript}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1200
    }
  })
}
