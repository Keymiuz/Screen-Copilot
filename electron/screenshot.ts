import { desktopCapturer, screen } from 'electron'
import sharp from 'sharp'

export interface ScreenshotOptions {
  maxWidth: number
  quality: number
}

export interface ScreenshotPayload {
  id: string
  capturedAt: number
  width: number
  height: number
  displayId?: string
  base64: string
  dataUrl: string
}

export async function captureActiveScreen(options: ScreenshotOptions): Promise<ScreenshotPayload> {
  const cursorPoint = screen.getCursorScreenPoint()
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint)
  const thumbnailSize = {
    width: Math.round(activeDisplay.size.width * activeDisplay.scaleFactor),
    height: Math.round(activeDisplay.size.height * activeDisplay.scaleFactor)
  }

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize
  })

  const source =
    sources.find((candidate) => candidate.display_id === String(activeDisplay.id)) ?? sources[0]

  if (!source || source.thumbnail.isEmpty()) {
    throw new Error('Nao foi possivel capturar a tela ativa.')
  }

  const pngBuffer = source.thumbnail.toPNG()
  const { data, info } = await sharp(pngBuffer)
    .resize({
      width: options.maxWidth,
      withoutEnlargement: true
    })
    .jpeg({ quality: options.quality })
    .toBuffer({ resolveWithObject: true })

  const base64 = data.toString('base64')

  return {
    id: `${Date.now()}-${activeDisplay.id}`,
    capturedAt: Date.now(),
    width: info.width,
    height: info.height,
    displayId: source.display_id,
    base64,
    dataUrl: `data:image/jpeg;base64,${base64}`
  }
}
