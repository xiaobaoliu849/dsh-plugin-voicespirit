import React, { useState } from 'react'
import type { VoiceAudioEngine, VoiceEngineState, VoiceTranscriptTurn } from '../engine/VoiceAudioEngine.ts'
import { VoiceSettingsPopover } from './VoiceSettingsPopover.tsx'
import styles from './VoiceCall.module.css'

interface VoiceCallOverlayProps {
  engine: VoiceAudioEngine
  state: VoiceEngineState
  micLevel: number
  speakerLevel: number
  currentUserText: string
  isUserInterim: boolean
  currentAssistantText: string
  historyTurns: VoiceTranscriptTurn[]
  onEndCall: () => void
  onToggleMute: () => void
  onInterrupt: () => void
  t: (key: any) => string
}

export const VoiceCallOverlay: React.FC<VoiceCallOverlayProps> = ({
  engine,
  state,
  micLevel,
  speakerLevel,
  currentUserText,
  isUserInterim,
  currentAssistantText,
  historyTurns,
  onEndCall,
  onToggleMute,
  onInterrupt,
  t,
}) => {
  const [isMinimized, setIsMinimized] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const getStatusText = () => {
    switch (state.phase) {
      case 'connecting': return t('statusConnecting')
      case 'listening': return t('statusListening')
      case 'speaking': return t('statusSpeaking')
      case 'interrupted': return t('statusInterrupted')
      case 'error': return state.errorMessage || t('statusError')
      default: return t('statusIdle')
    }
  }

  const getStatusDotClass = () => {
    switch (state.phase) {
      case 'connecting': return styles.statusDotConnecting
      case 'listening': return styles.statusDotListening
      case 'speaking': return styles.statusDotSpeaking
      case 'interrupted': return styles.statusDotInterrupted
      default: return ''
    }
  }

  // Generate dynamic waveform bars
  const renderWaveform = () => {
    const isSpeaking = state.phase === 'speaking'
    const activeLevel = isSpeaking ? speakerLevel : (state.isMuted ? 0 : micLevel)
    const count = 16
    const bars = []

    for (let i = 0; i < count; i++) {
      // Calculate dynamic pseudo-frequency heights
      const factor = Math.sin((i / count) * Math.PI)
      const baseHeight = 6
      const dynamicHeight = Math.min(52, Math.max(baseHeight, baseHeight + activeLevel * 46 * factor * (0.8 + Math.random() * 0.4)))
      bars.push(
        <div
          key={i}
          className={`${styles.waveBar} ${isSpeaking ? styles.waveBarAI : styles.waveBarUser}`}
          style={{ height: `${dynamicHeight}px` }}
        />
      )
    }
    return bars
  }

  if (isMinimized) {
    return (
      <div className={`${styles.voiceHudOverlay} ${styles.voiceHudMinimized}`}>
        <div className={styles.hudHeader} style={{ borderBottom: 'none', height: '100%' }}>
          <div className={styles.hudTitleGroup}>
            <div className={`${styles.statusDot} ${getStatusDotClass()}`} />
            <span>{getStatusText()}</span>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconBtn} onClick={() => setIsMinimized(false)} title={t('maximize')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
            <button className={`${styles.ctrlBtn} ${styles.endCallBtn}`} style={{ width: 28, height: 28 }} onClick={onEndCall} title={t('endVoiceCall')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.voiceHudOverlay}>
      {/* Header */}
      <div className={styles.hudHeader}>
        <div className={styles.hudTitleGroup}>
          <svg className={styles.voiceIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
          <span>{t('voiceCall')}</span>
          <div className={styles.statusBadge}>
            <div className={`${styles.statusDot} ${getStatusDotClass()}`} />
            {getStatusText()}
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            className={styles.iconBtn}
            onClick={() => setShowSettings(!showSettings)}
            title={t('settingsTitle')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button className={styles.iconBtn} onClick={() => setIsMinimized(true)} title={t('minimize')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Settings Modal Accordion */}
      {showSettings && (
        <VoiceSettingsPopover
          options={engine.getState()}
          onChange={(newOpts) => {
            engine.updateOptions(newOpts)
          }}
          onClose={() => setShowSettings(false)}
          t={t}
        />
      )}

      {/* Waveform Visualizer */}
      <div className={styles.waveformContainer}>
        {renderWaveform()}
      </div>

      {/* Realtime Live Subtitles / Transcript */}
      <div className={styles.transcriptBox}>
        {historyTurns.slice(-2).map((turn) => (
          <React.Fragment key={turn.id}>
            {turn.userText && <div className={styles.bubbleUser}>{turn.userText}</div>}
            {turn.assistantText && <div className={styles.bubbleAI}>{turn.assistantText}</div>}
          </React.Fragment>
        ))}

        {currentUserText && (
          <div className={`${styles.bubbleUser} ${isUserInterim ? styles.interim : ''}`}>
            {currentUserText}
          </div>
        )}

        {currentAssistantText && (
          <div className={styles.bubbleAI}>
            {currentAssistantText}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className={styles.hudFooter}>
        <div className={styles.ctrlGroup}>
          {/* Mute Button */}
          <button
            className={`${styles.ctrlBtn} ${state.isMuted ? styles.ctrlBtnMuted : ''}`}
            onClick={onToggleMute}
            title={state.isMuted ? t('unmuteMic') : t('muteMic')}
          >
            {state.isMuted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          {/* Interrupt Button */}
          {state.phase === 'speaking' && (
            <button
              className={styles.ctrlBtn}
              onClick={onInterrupt}
              title={t('statusInterrupted')}
              style={{ background: 'rgba(245, 158, 11, 0.2)', borderColor: '#f59e0b', color: '#fbbf24' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            </button>
          )}
        </div>

        {/* End Call Button */}
        <button
          className={`${styles.ctrlBtn} ${styles.endCallBtn}`}
          onClick={onEndCall}
          title={t('endVoiceCall')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" transform="rotate(135 12 12)" />
          </svg>
        </button>
      </div>
    </div>
  )
}
