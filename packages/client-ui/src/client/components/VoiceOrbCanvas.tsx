/**
 * High-performance 60FPS Canvas Fluid Voice Orb
 * Multi-layer organic fluid audio orb with dynamic aurora gradients,
 * audio-reactive energy ripples, ambient celestial glow, and specular highlights.
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
  size = 220,
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
    let time = 0

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
      time += 0.02

      // Smooth physics easing
      const speed = targetLevel > currentLevel ? 0.35 : 0.12
      currentLevel += (targetLevel - currentLevel) * speed

      const baseRadius = size * 0.26
      const dynamicRadius = baseRadius * (1 + currentLevel * 0.48)

      // ── 1. Celestial Ambient Background Nebula Glow ──
      const glowGrad = ctx.createRadialGradient(
        center,
        center,
        baseRadius * 0.2,
        center,
        center,
        center * 0.98,
      )
      if (speaking) {
        glowGrad.addColorStop(0, `rgba(99, 102, 241, ${0.45 + currentLevel * 0.45})`)
        glowGrad.addColorStop(0.35, `rgba(236, 72, 153, ${0.22 + currentLevel * 0.3})`)
        glowGrad.addColorStop(0.7, `rgba(59, 130, 246, ${0.12 + currentLevel * 0.2})`)
        glowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)')
      } else {
        glowGrad.addColorStop(0, `rgba(16, 185, 129, ${0.45 + currentLevel * 0.45})`)
        glowGrad.addColorStop(0.35, `rgba(6, 182, 212, ${0.22 + currentLevel * 0.3})`)
        glowGrad.addColorStop(0.7, `rgba(59, 130, 246, ${0.1 + currentLevel * 0.18})`)
        glowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)')
      }
      ctx.fillStyle = glowGrad
      ctx.beginPath()
      ctx.arc(center, center, center * 0.98, 0, Math.PI * 2)
      ctx.fill()

      // ── 2. Concentric Audio-Reactive Shockwave Rings ──
      const ringCount = 2
      for (let r = 1; r <= ringCount; r++) {
        const ringProgress = (time * 0.6 + r * 0.5) % 1
        const ringR = dynamicRadius + ringProgress * (size * 0.2)
        const ringAlpha = (1 - ringProgress) * (0.2 + currentLevel * 0.6)
        ctx.beginPath()
        ctx.arc(center, center, ringR, 0, Math.PI * 2)
        ctx.strokeStyle = speaking
          ? `rgba(168, 85, 247, ${ringAlpha})`
          : `rgba(52, 211, 153, ${ringAlpha})`
        ctx.lineWidth = 1.5 + currentLevel * 1.5
        ctx.stroke()
      }

      // ── 3. Multi-Harmonic Organic Fluid Blobs ──
      const blobCount = 3
      for (let b = 0; b < blobCount; b++) {
        ctx.save()
        ctx.translate(center, center)
        ctx.rotate(time * (0.4 + b * 0.25) * (b % 2 === 0 ? 1 : -1))

        const blobRadius = dynamicRadius * (0.88 + Math.sin(time * 2 + b) * 0.08)
        const blobGrad = ctx.createLinearGradient(
          -blobRadius,
          -blobRadius,
          blobRadius,
          blobRadius,
        )

        if (speaking) {
          if (b === 0) {
            blobGrad.addColorStop(0, '#6366f1')
            blobGrad.addColorStop(0.5, '#8b5cf6')
            blobGrad.addColorStop(1, '#ec4899')
          } else if (b === 1) {
            blobGrad.addColorStop(0, '#3b82f6')
            blobGrad.addColorStop(0.5, '#06b6d4')
            blobGrad.addColorStop(1, '#6366f1')
          } else {
            blobGrad.addColorStop(0, '#ec4899')
            blobGrad.addColorStop(0.5, '#f43f5e')
            blobGrad.addColorStop(1, '#8b5cf6')
          }
        } else {
          if (b === 0) {
            blobGrad.addColorStop(0, '#10b981')
            blobGrad.addColorStop(0.5, '#06b6d4')
            blobGrad.addColorStop(1, '#3b82f6')
          } else if (b === 1) {
            blobGrad.addColorStop(0, '#059669')
            blobGrad.addColorStop(0.5, '#10b981')
            blobGrad.addColorStop(1, '#6ee7b7')
          } else {
            blobGrad.addColorStop(0, '#0284c7')
            blobGrad.addColorStop(0.5, '#06b6d4')
            blobGrad.addColorStop(1, '#10b981')
          }
        }

        ctx.beginPath()
        // Draw fluid distorted polygon
        const points = 12
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2
          const wave = Math.sin(angle * 3 + time * 3 + b) * (4 + currentLevel * 14)
            + Math.cos(angle * 2 - time * 2) * (2 + currentLevel * 8)
          const dist = blobRadius + wave
          const x = Math.cos(angle) * dist
          const y = Math.sin(angle) * dist
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()

        ctx.fillStyle = blobGrad
        ctx.globalAlpha = 0.55 + b * 0.15
        ctx.shadowColor = speaking ? 'rgba(168, 85, 247, 0.7)' : 'rgba(16, 185, 129, 0.7)'
        ctx.shadowBlur = 18 + currentLevel * 28
        ctx.fill()
        ctx.restore()
      }

      // ── 4. Central Iridescent Core Sphere ──
      ctx.save()
      ctx.translate(center, center)
      const coreR = dynamicRadius * 0.76
      const coreGrad = ctx.createRadialGradient(
        -coreR * 0.25,
        -coreR * 0.25,
        coreR * 0.1,
        0,
        0,
        coreR,
      )

      if (speaking) {
        coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
        coreGrad.addColorStop(0.2, '#c084fc')
        coreGrad.addColorStop(0.55, '#6366f1')
        coreGrad.addColorStop(1, '#1e1b4b')
      } else {
        coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
        coreGrad.addColorStop(0.2, '#6ee7b7')
        coreGrad.addColorStop(0.55, '#059669')
        coreGrad.addColorStop(1, '#064e3b')
      }

      ctx.beginPath()
      ctx.arc(0, 0, coreR, 0, Math.PI * 2)
      ctx.fillStyle = coreGrad
      ctx.shadowColor = speaking ? '#8b5cf6' : '#10b981'
      ctx.shadowBlur = 24 + currentLevel * 32
      ctx.fill()
      ctx.restore()

      // ── 5. Specular Gloss Highlight ──
      const specGrad = ctx.createRadialGradient(
        center - dynamicRadius * 0.28,
        center - dynamicRadius * 0.28,
        1,
        center,
        center,
        dynamicRadius * 0.6,
      )
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)')
      specGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.25)')
      specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')

      ctx.beginPath()
      ctx.arc(center, center, dynamicRadius * 0.72, 0, Math.PI * 2)
      ctx.fillStyle = specGrad
      ctx.fill()

      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animId !== null) cancelAnimationFrame(animId)
      unsubscribe()
    }
  }, [controller, size])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  )
}
