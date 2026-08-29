/**
 * The native integrated dock ribbon above the composer while a call is live:
 * status dot, live audio waveform, model badge, single-line live streaming transcript,
 * and compact action controls (mute, interrupt, quick settings, immersive view, hang-up).
 */

import React, { useEffect } from 'react'
import type { VoiceSpiritController, VoiceSpiritUiState } from '../voice-controller.ts'
import { getLanguageDisplayBadge } from '../contract/settings.ts'
import type { VoiceSpiritKey } from '../locales.ts'
import { VoiceSettingsPopover } from './VoiceSettingsPopover.tsx'
import { VoiceWaveformCanvas } from './VoiceWaveformCanvas.tsx'
import styles from './VoiceCall.module.css'

export interface VoiceCallDockBarProps {
  snapshot: VoiceSpiritUiState
  controller: VoiceSpiritController
  t: (key: VoiceSpiritKey) => string
}

export const VoiceCallDockBar: React.FC<VoiceCallDockBarProps> = ({
  snapshot,
  controller,
  t,
}) => {
  const { engine } = snapshot
  const isSpeaking = engine.phase === 'speaking' || snapshot.speakerLevel > 0.05
  const isPushToTalk = Boolean(engine.isPushToTalk)

  // Global voice shortcut listener when call is live:
  // - Space (hold): Push to talk
  // - M: Toggle mute
  // - Enter (while AI speaking): Interrupt
  useEffect(() => {
    const isEditingText = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false
      const tag = target.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || target.isContentEditable
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      if (isEditingText(e.target)) return

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        controller.startPushToTalk()
      } else if (e.code === 'KeyM' && !e.repeat) {
        e.preventDefault()
        controller.toggleMute()
      } else if (e.key === 'Enter' && !e.repeat && isSpeaking) {
        e.preventDefault()
        controller.interrupt()
      }
    }

    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') {
        if (!isEditingText(e.target)) {
          e.preventDefault()
        }
        controller.stopPushToTalk()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [controller, isSpeaking])

  const cleanVoiceName = (name?: string) => {
    if (!name) return ''
    return name
      .replace(/^zh_female_/, '')
      .replace(/^zh_male_/, '')
      .replace(/_jupiter.*$/, '')
      .replace(/_bigtts.*$/, '')
      .replace(/_moon.*$/, '')
  }

  const voiceDisplay = cleanVoiceName(engine.voice)
  const providerLabel = [engine.provider, voiceDisplay]
    .filter(part => part && part.trim() !== '')
    .join(' · ')

  // Server errors carry their real cause
  const errorKey = controller.errorKey()
  const errorDetail = engine.phase === 'error'
    ? (errorKey !== undefined ? t(errorKey) : t('statusError'))
      + (engine.errorMessage ? ` — ${engine.errorMessage}` : '')
    : ''

  const isTranslateMode = snapshot.activeVoiceMode === 'translate'

  const currentTranscript = isTranslateMode
    ? (snapshot.translationText
        ? `🌐 ${snapshot.translationText}`
        : snapshot.userText
        ? `👤 ${snapshot.userText}`
        : undefined)
    : (snapshot.assistantText
        ? `${t('aiSpeaking')}: ${snapshot.assistantText}`
        : snapshot.userText
        ? `${t('userSpeaking')}: ${snapshot.userText}`
        : undefined)

  const reconnectingText = engine.reconnectAttempt
    ? `${t('statusReconnecting')} (${engine.reconnectAttempt}/3)…`
    : `${t('statusReconnecting')}…`

  const fallbackStatusText = engine.phase === 'reconnecting'
    ? reconnectingText
    : engine.phase === 'connecting' || snapshot.launching
    ? t('statusConnecting')
    : engine.phase === 'interrupted'
    ? t('statusInterrupted')
    : engine.phase === 'error'
    ? errorDetail
    : isTranslateMode
    ? t('liveTranslationActive')
    : isSpeaking
    ? t('statusSpeaking')
    : t('statusListening')

  const displayText = currentTranscript || fallbackStatusText

  return (
    <div className={`${styles.vsDockRibbon} ${isPushToTalk ? styles.dockPushToTalkActive : ''}`}>
      {/* 1. Left Cluster: Status dot, Waveform, Mode toggle & Language Pill */}
      <div className={styles.vsDockLeft}>
        <span
          className={`${styles.statusDot} ${
            engine.phase === 'reconnecting'
              ? styles.dotReconnecting
              : engine.phase === 'connecting' || snapshot.launching
              ? styles.dotConnecting
              : engine.phase === 'interrupted'
              ? styles.dotInterrupted
              : engine.phase === 'error'
              ? styles.dotError
              : isSpeaking
              ? styles.dotSpeaking
              : styles.dotListening
          }`}
          aria-hidden="true"
        />

        {/* Dynamic 60FPS Canvas Waveform */}
        <div
          className={styles.vsWaveform}
          title={isSpeaking ? t('statusSpeaking') : t('statusListening')}
        >
          <VoiceWaveformCanvas
            controller={controller}
            isSpeaking={isSpeaking}
            width={56}
            height={18}
          />
        </div>

        {/* Push-to-Talk active indicator */}
        {isPushToTalk && (
          <span className={styles.pttTag}>
            🎙️ {t('pushToTalkActive')}
          </span>
        )}

        {/* Mode Switcher Capsule */}
        <div className={styles.modeSegmentControl}>
          <button
            type="button"
            className={`${styles.modeSegmentBtn} ${!isTranslateMode ? styles.modeSegmentBtnActive : ''}`}
            onClick={() => { void controller.setVoiceMode('dialogue') }}
            title={t('modeDialogueDesc')}
          >
            <span>{t('modeDialogue')}</span>
          </button>
          <button
            type="button"
            className={`${styles.modeSegmentBtn} ${isTranslateMode ? styles.modeSegmentBtnActive : ''}`}
            onClick={() => { void controller.setVoiceMode('translate') }}
            title={t('modeTranslateDesc')}
          >
            <span>{t('modeTranslate')}</span>
          </button>
        </div>

        {/* LiveTranslate Language Pair Pill or Provider Badge */}
        {isTranslateMode ? (
          <div
            className={styles.langPairPill}
            onClick={() => { void controller.swapLanguages() }}
            title={t('swapLanguages')}
          >
            <span>{getLanguageDisplayBadge(snapshot.sourceLanguage)}</span>
            <button
              type="button"
              className={styles.langSwapBtn}
              onClick={(e) => {
                e.stopPropagation()
                void controller.swapLanguages()
              }}
              title={t('swapLanguages')}
            >
              ⇄
            </button>
            <span>{getLanguageDisplayBadge(snapshot.targetLanguage)}</span>
          </div>
        ) : (
          providerLabel && (
            <div className={styles.vsModelBadge} title={providerLabel}>
              {providerLabel}
            </div>
          )
        )}

        {/* Inline retry if session errored */}
        {engine.phase === 'error' && (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => { void controller.startCall() }}
            title={t('retry')}
          >
            {t('retry')}
          </button>
        )}
      </div>

      {/* 2. Center Cluster: Realtime Single-Line Transcript */}
      <div className={styles.vsDockCenter}>
        <span
          className={`${styles.vsLiveTranscript} ${currentTranscript ? styles.vsLiveTranscriptHighlight : ''}`}
          role="status"
          aria-live="polite"
          title={displayText}
        >
          {displayText}
        </span>
      </div>

      {/* 3. Right Cluster: Controls */}
      <div className={styles.vsDockRight}>
        {/* Space Push-to-Talk Hint */}
        <span className={styles.kbdHint} title={t('shortcutPushToTalk')}>
          <kbd className={styles.kbdBadge}>Space</kbd>
          <span style={{ fontSize: 10 }}>{t('pushToTalk')}</span>
        </span>

        {/* Mute Button with [M] shortcut */}
        <button
          type="button"
          className={`${styles.actionBtn} ${engine.isMuted ? styles.actionBtnMuted : ''}`}
          onClick={() => { controller.toggleMute() }}
          title={`${engine.isMuted ? t('unmute') : t('mute')} (${t('shortcutMute')})`}
        >
          {engine.isMuted ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          )}
        </button>

        {/* Interrupt Button with [Enter] shortcut */}
        {isSpeaking && (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => { controller.interrupt() }}
            title={`${t('interrupt')} (${t('shortcutInterrupt')})`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          </button>
        )}

        {/* Voice & Provider Quick Settings Popover */}
        <VoiceSettingsPopover snapshot={snapshot} controller={controller} t={t} />

        {/* Immersive Mode Expand Button */}
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => { controller.toggleImmersive() }}
          title={t('fullMode')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>

        {/* Hang Up Button */}
        <button
          type="button"
          className={styles.vsHangupBtn}
          onClick={() => { controller.endCall() }}
          title={t('endVoiceCall')}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(135deg)' }}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
            <line x1="22" y1="2" x2="16" y2="8" />
            <line x1="16" y1="2" x2="22" y2="8" />
          </svg>
          <span>{t('endVoiceCall')}</span>
        </button>
      </div>
    </div>
  )
}
