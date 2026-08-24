/**
 * High-performance 60FPS Canvas Fluid Voice Orb
 * Replaces heavy CSS animation and DOM-level scale thrashing with a direct
 * 2D Canvas rendering loop, featuring fluid particle audio rings, radial glow,
 * and high-DPI scaling.
 */

import React, { useEffect, useRef } from 'react'
import type { VoiceSpiritController } from '../voice-controller.ts'

export interface VoiceOrbCanvasProps {
  controller: VoiceSpiritController
  isSpeaking: boolean
  size?: number
  className?: string
}

export const VoiceOrbCanvas: React.FC<VoiceOrbCanvasProps> = ({
  controller,
  isSpeaking,
  size = 200,
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
    let currentLevel = 0
    let targetLevel = 0
    let rotation = 0

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)

    const unsubscribe = controller.subscribeLevels((levels) => {
      const speaking = isSpeakingRef.current
      targetLevel = speaking ? levels.speakerLevel : levels.micLevel
    })

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      const speaking = isSpeakingRef.current
      const center = size / 2
      rotation += 0.015

      // Smooth physics easing
      const speed = targetLevel > currentLevel ? 0.35 : 0.15
      currentLevel += (targetLevel - currentLevel) * speed

      const baseRadius = size * 0.28
      const dynamicRadius = baseRadius * (1 + currentLevel * 0.45)

      // 1. Ambient Radial Glow
      const glowGrad = ctx.createRadialGradient(
        center,
        center,
        baseRadius * 0.5,
        center,
        center,
        center * 0.95,
      )
      if (speaking) {
        glowGrad.addColorStop(0, `rgba(99, 102, 241, ${0.35 + currentLevel * 0.45})`)
        glowGrad.addColorStop(0.5, `rgba(59, 130, 246, ${0.15 + currentLevel * 0.25})`)
        glowGrad.addColorStop(1, 'rgba(59, 130, 246, 0)')
      } else {
        glowGrad.addColorStop(0, `rgba(16, 185, 129, ${0.35 + currentLevel * 0.45})`)
        glowGrad.addColorStop(0.5, `rgba(6, 182, 212, ${0.15 + currentLevel * 0.25})`)
        glowGrad.addColorStop(1, 'rgba(6, 182, 212, 0)')
      }
      ctx.fillStyle = glowGrad
      ctx.beginPath()
      ctx.arc(center, center, center * 0.95, 0, Math.PI * 2)
      ctx.fill()

      // 2. Soundwave Pulse Ring
      const ringRadius = dynamicRadius * (1.15 + currentLevel * 0.3)
      ctx.beginPath()
      ctx.arc(center, center, ringRadius, 0, Math.PI * 2)
      ctx.strokeStyle = speaking
        ? `rgba(147, 197, 253, ${0.2 + currentLevel * 0.5})`
        : `rgba(110, 231, 183, ${0.2 + currentLevel * 0.5})`
      ctx.lineWidth = 1.5 + currentLevel * 2
      ctx.stroke()

      // 3. Inner Iridescent Core Orb
      ctx.save()
      ctx.translate(center, center)
      ctx.rotate(rotation)

      const coreGrad = ctx.createLinearGradient(
        -dynamicRadius,
        -dynamicRadius,
        dynamicRadius,
        dynamicRadius,
      )
      if (speaking) {
        coreGrad.addColorStop(0, '#4f46e5')
        coreGrad.addColorStop(0.5, '#3b82f6')
        coreGrad.addColorStop(1, '#818cf8')
      } else {
        coreGrad.addColorStop(0, '#059669')
        coreGrad.addColorStop(0.5, '#10b981')
        coreGrad.addColorStop(1, '#34d399')
      }

      ctx.beginPath()
      ctx.arc(0, 0, dynamicRadius, 0, Math.PI * 2)
      ctx.fillStyle = coreGrad
      ctx.shadowColor = speaking ? 'rgba(99, 102, 241, 0.6)' : 'rgba(16, 185, 129, 0.6)'
      ctx.shadowBlur = 16 + currentLevel * 24
      ctx.fill()
      ctx.restore()

      // 4. Center Specular Highlight
      const highlightGrad = ctx.createRadialGradient(
        center - dynamicRadius * 0.3,
        center - dynamicRadius * 0.3,
        2,
        center,
        center,
        dynamicRadius,
      )
      highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)')
      highlightGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.1)')
      highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')

      ctx.beginPath()
      ctx.arc(center, center, dynamicRadius, 0, Math.PI * 2)
      ctx.fillStyle = highlightGrad
      ctx.fill()

      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)

    return () => {
      if (animId !== null) cancelAnimationFrame(animId)
      unsubscribe()
    }
  }, [controller, size])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: `${size}px`, height: `${size}px`, display: 'block' }}
      aria-hidden="true"
    />
  )
}
