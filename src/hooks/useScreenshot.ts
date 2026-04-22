import { useCallback, useEffect, useState } from 'react'
import { useChatStore } from '../store/chatStore'

export function useScreenshot(): {
  isCapturing: boolean
  flash: boolean
  capture: () => Promise<void>
} {
  const setLastScreenshot = useChatStore((state) => state.setLastScreenshot)
  const [isCapturing, setIsCapturing] = useState(false)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    const unsubscribeScreenshot = window.screenMind.onScreenshot((screenshot) => {
      setLastScreenshot(screenshot)
    })

    const unsubscribeFlash = window.screenMind.onOverlayFlash(() => {
      setFlash(true)
      window.setTimeout(() => setFlash(false), 320)
    })

    return () => {
      unsubscribeScreenshot()
      unsubscribeFlash()
    }
  }, [setLastScreenshot])

  const capture = useCallback(async () => {
    setIsCapturing(true)

    try {
      const screenshot = await window.screenMind.captureScreen()

      if (screenshot) {
        setLastScreenshot(screenshot)
      }
    } finally {
      setIsCapturing(false)
    }
  }, [setLastScreenshot])

  return { isCapturing, flash, capture }
}
