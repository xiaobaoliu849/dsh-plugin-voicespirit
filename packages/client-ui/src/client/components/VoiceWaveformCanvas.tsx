/**
 * High-performance 60FPS Canvas Waveform Visualizer
 * Decouples audio spectrum animations from React's render lifecycle,
 * rendering rounded capsule spectrum bars directly on an HTML5 2D Canvas
 * with high-DPI scaling and physics easing.
 */

import React, { useEffect, useRef } from 'react'
import type { VoiceSpiritController } from '../voice-controller.ts'
import { SPECTRUM_BANDS } from '../engine/VoiceAudioEngine.ts'

export interface VoiceWaveformCanvasProps {
  controller: VoiceSpiritController
  isSpeaking: boolean
  width?: number
  height?: number
  className?: string
}

export const VoiceWaveformCanvas: React.FC<VoiceWaveformCanvasProps> = ({
  controller,
  isSpeaking,
  width = 68,
  height = 20,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isSpeakingRef = useRef(isSpeaking)
  isSpeakingRef.current = isSpeaking

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number | null = null
    const barCount = SPECTRUM_BANDS
    const currentHeights = new Array<number>(barCount).fill(3)
    const targetHeights = new Array<number>(barCount).fill(3)

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)

    // Direct listener bypassing React tree reconciliation
    const unsubscribe = controller.subscribeLevels((levels) => {
      const speaking = isSpeakingRef.current
      const bands = speaking ? levels.spkBands : levels.micBands
      for (let i = 0; i < barCount; i++) {
        const val = bands[i] ?? 0
        targetHeights[i] = 3 + Math.min(height - 4, val * (height * 2.2))
      }
    })

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      const speaking = isSpeakingRef.current
      const barWidth = 3
      const barRadius = 1.5
      const totalBarsWidth = barCount * barWidth
      const availableSpace = width - totalBarsWidth
      const gap = Math.max(2, availableSpace / (barCount - 1))
      const centerY = height / 2

      // Create gradient for bars (warm sunset & golden amber)
      const grad = ctx.createLinearGradient(0, 0, width, 0)
      if (speaking) {
        grad.addColorStop(0, '#f43f5e')
        grad.addColorStop(0.5, '#ec4899')
        grad.addColorStop(1, '#a855f7')
      } else {
        grad.addColorStop(0, '#f97316')
        grad.addColorStop(0.5, '#f59e0b')
        grad.addColorStop(1, '#fbbf24')
      }

      ctx.fillStyle = grad

      for (let i = 0; i < barCount; i++) {
        const current = currentHeights[i] ?? 3
        const target = targetHeights[i] ?? 3
        const speed = target > current ? 0.45 : 0.2
        const next = current + (target - current) * speed
        currentHeights[i] = next

        const x = i * (barWidth + gap)
        const h = Math.max(3, next)
        const y = centerY - h / 2

        ctx.beginPath()
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, h, barRadius)
        } else {
          ctx.rect(x, y, barWidth, h)
        }
        ctx.fill()
      }

      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)

    return () => {
      if (animId !== null) cancelAnimationFrame(animId)
      unsubscribe()
    }
  }, [controller, width, height])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: `${width}px`, height: `${height}px` }}
      aria-hidden="true"
    />
  )
}
