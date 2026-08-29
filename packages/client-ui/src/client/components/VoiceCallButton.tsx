/**
 * VoiceCallHeaderButton: Rendered in conversation.input.right
 * Displays:
 * 1. Pre-call Provider & Voice Pill [ 🎙 DashScope · Cherry ▾ ] to configure
 *    providers and voices BEFORE starting a call.
 * 2. Realtime Mic toggle button to start/end calls.
 */

import React, { useState, useEffect } from 'react'
import type { VoiceSpiritController, VoiceSpiritUiState } from '../voice-controller.ts'
import type { VoiceSpiritKey } from '../locales.ts'
import { VoiceSettingsPopover } from './VoiceSettingsPopover.tsx'
import styles from './VoiceCall.module.css'

export interface VoiceCallHeaderButtonProps {
  controller?: VoiceSpiritController
  t?: (key: VoiceSpiritKey) => string
  actions?: {
    startCall: () => void
    endCall: () => void
    toggleMute: () => void
    interrupt: () => void
    toggleImmersive: () => void
    isCallActive: boolean
    isMuted: boolean
  }
}

export const VoiceCallHeaderButton: React.FC<VoiceCallHeaderButtonProps> = (props) => {
  const { controller, actions } = props
  const [snapshot, setSnapshot] = useState<VoiceSpiritUiState | undefined>(() => controller?.getSnapshot())

  useEffect(() => {
    if (!controller) return
    setSnapshot(controller.getSnapshot())
    return controller.subscribe(() => { setSnapshot(controller.getSnapshot()) })
  }, [controller])

  const isCallActive = actions?.isCallActive || false
  const t = typeof props.t === 'function' ? props.t : (k: string) => k

  const cleanVoiceName = (name?: string) => {
    if (!name) return ''
    return name
      .replace(/^zh_female_/, '')
      .replace(/^zh_male_/, '')
      .replace(/_jupiter.*$/, '')
      .replace(/_bigtts.*$/, '')
      .replace(/_moon.*$/, '')
  }

  const provider = snapshot?.engine.provider || 'DashScope'
  const voice = cleanVoiceName(snapshot?.engine.voice) || 'Default'
  const badgeLabel = `${provider} · ${voice}`

  return (
    <div className={styles.preCallGroup}>
      {/* 1. Pre-call Provider & Voice Pill (Accessible BEFORE call) */}
      {!isCallActive && controller && snapshot && (
        <VoiceSettingsPopover
          snapshot={snapshot}
          controller={controller}
          t={t as (key: VoiceSpiritKey) => string}
          customTrigger={(toggleOpen, isOpen) => (
            <button
              type="button"
              className={`${styles.preCallPill} ${isOpen ? styles.preCallPillOpen : ''}`}
              onClick={toggleOpen}
              title="切换语音服务商与音色 (Voice Provider & Timbre)"
            >
              <span className={styles.preCallPillDot} />
              <span className={styles.preCallPillText}>{badgeLabel}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        />
      )}

      {/* 2. Primary Mic trigger button */}
      <button
        type="button"
        className={`${styles.toolMicBtn} ${isCallActive ? styles.toolMicBtnActive : ''}`}
        onClick={() => {
          if (isCallActive) {
            actions?.endCall()
          } else {
            actions?.startCall()
          }
        }}
        title={isCallActive ? (t('endVoiceCall') as string) : (t('startVoiceCall') as string)}
        aria-label={isCallActive ? (t('endVoiceCall') as string) : (t('startVoiceCall') as string)}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      </button>
    </div>
  )
}
