import type { InlineAttachment } from './googleClient'

const MAX_TEXT_BYTES = 2_000_000
const MAX_INLINE_FILE_BYTES = 20_000_000
const MAX_EXTERNAL_FILE_BYTES = 100_000_000
const MAX_TEXT_CHARS = 120_000

export interface RemoteDocument {
  url: string
  title: string
  contentType: string
  text?: string
  attachment?: InlineAttachment
}

function normalizeUrl(input: string): URL {
  const url = new URL(input.trim())

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Cole uma URL que comece com http:// ou https://.')
  }

  const hostname = url.hostname.toLowerCase()
  const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1']

  if (blockedHosts.includes(hostname) || hostname.endsWith('.local')) {
    throw new Error('Use uma URL publica da internet.')
  }

  return url
}

function normalizeKnownFileUrl(url: URL): URL {
  const hostname = url.hostname.toLowerCase()

  if (hostname === 'github.com') {
    const segments = url.pathname.split('/').filter(Boolean)

    if (segments.length < 5 || segments[2] !== 'blob') {
      return url
    }

    const [owner, repo, , ref, ...filePath] = segments
    const rawUrl = new URL(
      `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath.join('/')}`
    )
    rawUrl.search = url.search
    rawUrl.hash = url.hash

    return rawUrl
  }

  if (hostname === 'drive.google.com') {
    const segments = url.pathname.split('/').filter(Boolean)
    const fileIndex = segments.indexOf('d')
    const fileId =
      fileIndex >= 0
        ? segments[fileIndex + 1]
        : url.searchParams.get('id') ?? url.searchParams.get('fileid')

    if (fileId) {
      return new URL(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`)
    }
  }

  return url
}

function decodeUrlPathPart(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const namedEntities: Record<string, string> = {
      amp: '&',
      apos: "'",
      gt: '>',
      lt: '<',
      nbsp: ' ',
      quot: '"'
    }

    if (entity[0] === '#') {
      const isHex = entity[1]?.toLowerCase() === 'x'
      const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
    }

    return namedEntities[entity.toLowerCase()] ?? match
  })
}

function extractTitle(html: string, fallbackUrl: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]

  if (!title) {
    return fallbackUrl
  }

  return decodeHtmlEntities(title.replace(/\s+/g, ' ').trim()) || fallbackUrl
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<(br|hr)\b[^>]*>/gi, '\n')
      .replace(/<\/(p|div|section|article|main|header|footer|li|h[1-6]|tr|table|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

async function readResponseBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get('content-length') ?? 0)

  if (contentLength > maxBytes) {
    throw new Error('Esse documento e grande demais para resumir direto pela URL.')
  }

  if (!response.body) {
    throw new Error('Nao consegui ler o conteudo dessa URL.')
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    if (!value) {
      continue
    }

    total += value.byteLength

    if (total > maxBytes) {
      throw new Error('Esse documento e grande demais para resumir direto pela URL.')
    }

    chunks.push(value)
  }

  const bytes = new Uint8Array(total)
  let offset = 0

  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  return bytes
}

function urlPathLooksPdf(url: URL): boolean {
  return url.pathname.toLowerCase().endsWith('.pdf')
}

function getContentDispositionFilename(response: Response): string {
  const disposition = response.headers.get('content-disposition') ?? ''
  const utf8Filename = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const filename = utf8Filename ?? disposition.match(/filename="?([^";]+)"?/i)?.[1]

  return filename ? decodeUrlPathPart(filename.trim()) : ''
}

function responseLooksPdf(contentType: string, url: URL, filename: string): boolean {
  if (contentType.includes('html')) {
    return false
  }

  return (
    contentType.includes('application/pdf') ||
    filename.toLowerCase().endsWith('.pdf') ||
    (urlPathLooksPdf(url) &&
      (!contentType ||
        contentType.includes('application/octet-stream') ||
        contentType.includes('binary/octet-stream')))
  )
}

function getContentLength(response: Response): number {
  return Number(response.headers.get('content-length') ?? 0)
}

function getFileTitle(url: URL): string {
  const filename = url.pathname.split('/').filter(Boolean).pop()
  return filename ? decodeUrlPathPart(filename) : url.hostname
}

function shouldInlinePdf(url: URL, contentLength: number): boolean {
  const hostname = url.hostname.toLowerCase()

  return (
    contentLength <= MAX_INLINE_FILE_BYTES ||
    hostname === 'drive.google.com' ||
    hostname === 'drive.usercontent.google.com'
  )
}

export async function fetchRemoteDocument(input: string): Promise<RemoteDocument> {
  const url = normalizeKnownFileUrl(normalizeUrl(input))
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 18_000)

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html, text/plain, text/markdown, application/pdf;q=0.9, */*;q=0.5',
        'User-Agent': 'ScreenMind/0.1 URL Summarizer'
      }
    })

    if (!response.ok) {
      throw new Error(`Essa URL respondeu com erro ${response.status}.`)
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
    const filename = getContentDispositionFilename(response)

    if (responseLooksPdf(contentType, url, filename)) {
      const contentLength = getContentLength(response)

      if (contentLength > MAX_EXTERNAL_FILE_BYTES) {
        throw new Error('Esse PDF e grande demais para o Gemini buscar direto pela URL.')
      }

      if (shouldInlinePdf(url, contentLength)) {
        const bytes = await readResponseBytes(response, MAX_INLINE_FILE_BYTES)

        return {
          url: response.url || url.toString(),
          title: filename || getFileTitle(url),
          contentType: 'application/pdf',
          attachment: {
            mimeType: 'application/pdf',
            data: Buffer.from(bytes).toString('base64')
          }
        }
      }

      await response.body?.cancel().catch(() => undefined)

      return {
        url: response.url || url.toString(),
        title: filename || getFileTitle(url),
        contentType: 'application/pdf',
        attachment: {
          mimeType: 'application/pdf',
          fileUri: response.url || url.toString()
        }
      }
    }

    const bytes = await readResponseBytes(response, MAX_TEXT_BYTES)
    const rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    const isHtml = contentType.includes('html') || /<html[\s>]/i.test(rawText)
    const text = (isHtml ? htmlToText(rawText) : rawText.replace(/\s+/g, ' ').trim()).slice(
      0,
      MAX_TEXT_CHARS
    )

    if (text.length < 80) {
      throw new Error('Nao encontrei texto suficiente nessa URL para resumir.')
    }

    return {
      url: response.url || url.toString(),
      title: isHtml ? extractTitle(rawText, url.hostname) : url.hostname,
      contentType: contentType || 'text/plain',
      text
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('A URL demorou demais para responder.')
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}
