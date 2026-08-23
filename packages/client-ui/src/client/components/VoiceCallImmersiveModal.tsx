/**
 * The immersive full-screen call view: oversized orb, subtitle stream, and the
 * call controls. Selection changes go through the controller (settings scope),
 * never through prop mutation.
 */

import React, { useEffect, useRef } from 'react'
import type { VoiceSpiritController, VoiceSpiritUiState } from '../voice-controller.ts'
import type { VoiceSpiritKey } from '../locales.ts'
import { VoiceSettingsPopover } from './VoiceSettingsPopover.tsx'
import { VoiceTextInput } from './VoiceTextInput.tsx'
import styles from './VoiceCall.module.css'

export interface VoiceCallImmersiveModalProps {
  snapshot: VoiceSpiritUiState
  controller: VoiceSpiritController
  t: (key: VoiceSpiritKey) => string
}

export const VoiceCallImmersiveModal: React.FC<VoiceCallImmersiveModalProps> = ({
  snapshot,
  controller,
  t,
}) => {
  const { engine } = snapshot
  const isSpeaking = engine.phase === 'speaking' || snapshot.speakerLevel > 0.05
  const isPushToTalk = Boolean(engine.isPushToTalk)
  const activeLevel = isSpeaking ? snapshot.speakerLevel : snapshot.micLevel
  const orbScale = 1 + Math.min(0.35, activeLevel * 0.7)

  const backdropRef = useRef<HTMLDivElement>(null)
  const subtitlesRef = useRef<HTMLDivElement>(null)

  // Keyboard shortcuts within immersive view:
  // - Escape: leave immersive
  // - Space (hold): push-to-talk
  // - M: toggle mute
  // - Enter (while AI speaking): interrupt
  useEffect(() => {
    const isEditingText = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false
      const tag = target.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || target.isContentEditable
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        controller.closeImmersive()
        return
      }

      if (isEditingText(event.target)) return

      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault()
        controller.startPushToTalk()
      } else if (event.code === 'KeyM' && !event.repeat) {
        event.preventDefault()
        controller.toggleMute()
      } else if (event.key === 'Enter' && !event.repeat && isSpeaking) {
        event.preventDefault()
        controller.interrupt()
      }
    }

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space') {
        if (!isEditingText(event.target)) {
          event.preventDefault()
        }
        controller.stopPushToTalk()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    backdropRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [controller, isSpeaking])

  // Keep the newest subtitle in view as turns stream in.
  useEffect(() => {
    const node = subtitlesRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [snapshot.historyTurns, snapshot.userText, snapshot.assistantText])

  return (
    <div
      ref={backdropRef}
      className={styles.immersiveBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={`VoiceSpirit — ${engine.provider}`}
      tabIndex={-1}
    >
      {/* Top Header */}
      <div className={styles.immersiveHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#f3f4f6', letterSpacing: '-0.01em' }}>
            VoiceSpirit
          </span>
          <span className={styles.statusPill}>
            <span
              className={`${styles.statusDot} ${
                engine.phase === 'reconnecting'
                  ? styles.dotReconnecting
                  : engine.phase === 'connecting' || snapshot.launching
                  ? styles.dotConnecting
                  : isSpeaking
                  ? styles.dotSpeaking
                  : styles.dotListening
              }`}
            />
            {engine.phase === 'reconnecting' ? (
              <span style={{ color: '#f59e0b' }}>
                {engine.reconnectAttempt
                  ? `${t('statusReconnecting')} (${engine.reconnectAttempt}/3)…`
                  : `${t('statusReconnecting')}…`}
              </span>
            ) : isPushToTalk ? (
              <span className={styles.pttTag} style={{ marginLeft: 2 }}>
                🎙️ {t('pushToTalkActive')}
              </span>
            ) : (
              `${engine.provider} · ${engine.voice}`
            )}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <VoiceSettingsPopover snapshot={snapshot} controller={controller} t={t} />
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => { controller.closeImmersive() }}
            title={t('minimize')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="14" x2="10" y2="14" />
              <line x1="10" y1="14" x2="10" y2="20" />
              <line x1="20" y1="10" x2="14" y2="10" />
              <line x1="14" y1="10" x2="14" y2="4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Pulsating Fluid Audio Orb */}
      <div className={styles.orbContainer}>
        <div className={styles.orbRing} />
        {/* Scale rides a wrapper layer: the orb's own transform is owned by
            the rotate animation, which would override an inline scale. */}
        <div
          style={{
            transform: `scale(${orbScale})`,
            transition: 'transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)',
            display: 'flex',
          }}
        >
          <div className={`${styles.voiceOrb} ${!isSpeaking ? styles.voiceOrbListening : ''}`} />
        </div>
      </div>

      {/* Live Transcript Stream */}
      <div ref={subtitlesRef} className={styles.immersiveSubtitles}>
        {snapshot.historyTurns.slice(-4).map((turn) => (
          <React.Fragment key={turn.id}>
            <div className={styles.userSubtitle}>{turn.userText}</div>
            {turn.translationText && (
              <div className={styles.aiSubtitle} style={{ color: '#38bdf8' }}>
                🌐 {turn.translationText}
              </div>
            )}
            {turn.assistantText && !turn.translationText && (
              <div className={styles.aiSubtitle}>{turn.assistantText}</div>
            )}
          </React.Fragment>
        ))}

        {snapshot.userText && (
          <div className={styles.userSubtitle} style={{ opacity: snapshot.isUserInterim ? 0.7 : 1 }}>
            {snapshot.userText}
          </div>
        )}

        {snapshot.translationText && (
          <div className={styles.aiSubtitle} style={{ color: '#38bdf8' }}>
            🌐 {snapshot.translationText}
          </div>
        )}

        {snapshot.assistantText && !snapshot.translationText && (
          <div className={styles.aiSubtitle}>
            {snapshot.assistantText}
          </div>
        )}
      </div>

      {/* Type-into-the-call row */}
      <VoiceTextInput snapshot={snapshot} controller={controller} t={t} />

      {/* Bottom Controls */}
      <div className={styles.immersiveFooter}>
        {/* Mute Button */}
        <button
          type="button"
          className={`${styles.actionBtn} ${engine.isMuted ? styles.actionBtnMuted : ''}`}
          style={{ width: 44, height: 44, borderRadius: 22 }}
          onClick={() => { controller.toggleMute() }}
          title={`${engine.isMuted ? t('unmute') : t('mute')} (${t('shortcutMute')})`}
        >
          {engine.isMuted ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          )}
        </button>

        {/* Interrupt Button */}
        {isSpeaking && (
          <button
            type="button"
            className={styles.actionBtn}
            style={{ width: 44, height: 44, borderRadius: 22 }}
            onClick={() => { controller.interrupt() }}
            title={`${t('interrupt')} (${t('shortcutInterrupt')})`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          </button>
        )}

        {/* Hang Up Button */}
        <button
          type="button"
          className={styles.hangupBtn}
          style={{ height: 44, padding: '0 20px', borderRadius: 22, fontSize: 14 }}
          onClick={() => {
            controller.closeImmersive()
            controller.endCall()
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(135deg)' }}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
            <line x1="22" y1="2" x2="16" y2="8" />
            <line x1="16" y1="2" x2="22" y2="8" />
          </svg>
          <span>{t('endVoiceCall')}</span>
        </button>
      </div>

      {/* Keyboard Shortcuts Hint Bar */}
      <div className={styles.immersiveShortcutBar}>
        <span className={styles.kbdHint}>
          <kbd className={styles.kbdBadge}>Space</kbd> {t('shortcutPushToTalk')}
        </span>
        <span className={styles.kbdHint}>
          <kbd className={styles.kbdBadge}>M</kbd> {t('shortcutMute')}
        </span>
        <span className={styles.kbdHint}>
          <kbd className={styles.kbdBadge}>Enter</kbd> {t('shortcutInterrupt')}
        </span>
        <span className={styles.kbdHint}>
          <kbd className={styles.kbdBadge}>Esc</kbd> {t('shortcutImmersive')}
        </span>
      </div>
    </div>
  )
}
