/**
 * The dock ribbon above the composer while a call is live: status pill with
 * the live transcript, provider badge, reactive waveform, mute / interrupt /
 * quick settings / immersive, and the hang-up. All copy flows through the
 * plugin locale; the backend phase rides the same snapshot as the call state.
 */

import React from 'react'
import type { VoiceSpiritController, VoiceSpiritUiState } from '../voice-controller.ts'
import { SPECTRUM_BANDS } from '../engine/VoiceAudioEngine.ts'
import type { VoiceSpiritKey } from '../locales.ts'
import { VoiceSettingsPopover } from './VoiceSettingsPopover.tsx'
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

  // Real log-spaced spectrum from the engine — one bar per band. Flat stubs
  // until the first sample lands; the analyser's smoothing keeps motion fluid.
  const bands = isSpeaking ? snapshot.spkBands : snapshot.micBands
  const waveHeights: number[] = bands.length === SPECTRUM_BANDS
    ? bands.map((v) => 4 + Math.min(28, v * 64))
    : new Array<number>(SPECTRUM_BANDS).fill(4)

  const providerLabel = [engine.provider, engine.model, engine.voice]
    .filter(part => part !== '')
    .join(' / ')

  // Server errors carry their real cause (missing key, bad realtime URL) —
  // append it so the ribbon says what actually went wrong.
  const errorDetail = engine.phase === 'error'
    ? (controller.errorKey() !== undefined ? t(controller.errorKey()!) : t('statusError'))
      + (engine.errorMessage ? ` — ${engine.errorMessage}` : '')
    : ''
  const statusText = snapshot.assistantText
    ? `${t('aiSpeaking')}: ${snapshot.assistantText}`
    : snapshot.userText
    ? `${t('userSpeaking')}: ${snapshot.userText}`
    : engine.phase === 'connecting' || snapshot.launching
    ? t('statusConnecting')
    : engine.phase === 'interrupted'
    ? t('statusInterrupted')
    : engine.phase === 'error'
    ? errorDetail
    : isSpeaking
    ? t('statusSpeaking')
    : t('statusListening')

  // Mute must stay visible even while a transcript is streaming.
  const fullStatusText = engine.isMuted && engine.phase !== 'error'
    ? `${t('mutedState')} · ${statusText}`
    : statusText

  return (
    <div className={styles.vsDockRibbon}>
      <div className={styles.vsDockLeft}>
        {/* Status Indicator */}
        <div className={styles.vsStatusPill}>
          <span
            className={`${styles.statusDot} ${
              engine.phase === 'connecting' || snapshot.launching
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
          <span className={styles.vsStatusText} role="status" aria-live="polite">{fullStatusText}</span>
        </div>

        {/* Inline retry when the session failed */}
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

        {/* Model Tag */}
        <div className={styles.vsModelBadge} title={providerLabel}>
          {providerLabel}
        </div>
      </div>

      <div className={styles.vsDockRight}>
        {/* Dynamic Jumping Waveform */}
        <div
          className={styles.vsWaveform}
          title={isSpeaking ? t('statusSpeaking') : t('statusListening')}
        >
          {waveHeights.map((h, i) => (
            <div
              key={i}
              className={`${styles.vsWaveBar} ${isSpeaking ? styles.vsWaveBarAI : styles.vsWaveBarMic}`}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>

        {/* Mute Button */}
        <button
          type="button"
          className={`${styles.actionBtn} ${engine.isMuted ? styles.actionBtnMuted : ''}`}
          onClick={() => { controller.toggleMute() }}
          title={engine.isMuted ? t('unmute') : t('mute')}
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

        {/* Interrupt Button */}
        {isSpeaking && (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => { controller.interrupt() }}
            title={t('interrupt')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          </button>
        )}

        {/* Voice & Provider Quick Settings */}
        <VoiceSettingsPopover snapshot={snapshot} controller={controller} t={t} />

        {/* Immersive Mode */}
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

        {/* Hang Up Button (VoiceSpirit Exact Red Badge) */}
        <button
          type="button"
          className={styles.vsHangupBtn}
          onClick={() => { controller.endCall() }}
          title={t('endVoiceCall')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(135deg)' }}>
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
