import type { BackgroundToOffscreenMessage, RuntimeMessage } from '../shared/types'

let mediaRecorder: MediaRecorder | null = null
let mediaStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let chunkIndex = 0

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function stopCapture(): Promise<void> {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }

  mediaStream?.getTracks().forEach((track) => track.stop())
  mediaStream = null

  if (audioContext) {
    await audioContext.close().catch(() => undefined)
    audioContext = null
  }
}

async function startCapture(streamId: string): Promise<void> {
  await stopCapture()
  chunkIndex = 0

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    } as MediaTrackConstraints,
    video: false
  })

  audioContext = new AudioContext()
  const source = audioContext.createMediaStreamSource(mediaStream)
  source.connect(audioContext.destination)

  const preferredMimeType = 'audio/webm;codecs=opus'
  const mimeType = MediaRecorder.isTypeSupported(preferredMimeType) ? preferredMimeType : 'audio/webm'
  mediaRecorder = new MediaRecorder(mediaStream, { mimeType })

  mediaRecorder.ondataavailable = (event) => {
    if (!event.data.size) {
      return
    }

    void blobToDataUrl(event.data)
      .then((dataUrl) =>
        chrome.runtime.sendMessage({
          type: 'offscreen:audio-chunk',
          payload: {
            dataUrl,
            mimeType,
            chunkIndex: chunkIndex++
          }
        } satisfies RuntimeMessage)
      )
      .catch((error) =>
        chrome.runtime.sendMessage({
          type: 'offscreen:error',
          payload: {
            message: error instanceof Error ? error.message : 'Falha ao ler chunk de audio.'
          }
        } satisfies RuntimeMessage)
      )
  }

  mediaRecorder.onerror = () => {
    void chrome.runtime.sendMessage({
      type: 'offscreen:error',
      payload: {
        message: 'MediaRecorder falhou durante a captura.'
      }
    } satisfies RuntimeMessage)
  }

  mediaRecorder.onstop = () => {
    void chrome.runtime.sendMessage({ type: 'offscreen:stopped' } satisfies RuntimeMessage)
  }

  mediaRecorder.start(15_000)
}

chrome.runtime.onMessage.addListener((message: BackgroundToOffscreenMessage, _sender, sendResponse) => {
  if (message.type === 'offscreen:start') {
    void startCapture(message.payload.streamId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        void chrome.runtime.sendMessage({
          type: 'offscreen:error',
          payload: {
            message: error instanceof Error ? error.message : 'Falha ao iniciar captura de audio.'
          }
        } satisfies RuntimeMessage)
        sendResponse({ ok: false })
      })

    return true
  }

  if (message.type === 'offscreen:stop') {
    void stopCapture()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }))

    return true
  }

  return false
})

void chrome.runtime.sendMessage({ type: 'offscreen:ready' } satisfies RuntimeMessage)
