import React from 'react'
import type { VoiceAudioEngine, VoiceEngineState, VoiceTranscriptTurn } from '../engine/VoiceAudioEngine.ts'
import { VoiceSettingsPopover } from './VoiceSettingsPopover.tsx'
import styles from './VoiceCall.module.css'

interface VoiceCallImmersiveModalProps {
  engine: VoiceAudioEngine
  state: VoiceEngineState
  micLevel: number
  speakerLevel: number
  currentUserText: string
  isUserInterim: boolean
  currentAssistantText: string
  historyTurns: VoiceTranscriptTurn[]
  onClose: () => void
  onEndCall: () => void
  onToggleMute: () => void
  onInterrupt: () => void
  t: (k: any) => string
}

export const VoiceCallImmersiveModal: React.FC<VoiceCallImmersiveModalProps> = ({
  engine,
  state,
  micLevel,
  speakerLevel,
  currentUserText,
  isUserInterim,
  currentAssistantText,
  historyTurns,
  onClose,
  onEndCall,
  onToggleMute,
  onInterrupt,
  t,
}) => {
  const isSpeaking = state.phase === 'speaking' || speakerLevel > 0.05
  const activeLevel = isSpeaking ? speakerLevel : micLevel
  const orbScale = 1 + Math.min(0.35, activeLevel * 0.7)

  return (
    <div className={styles.immersiveBackdrop}>
      {/* Top Header */}
      <div className={styles.immersiveHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#f3f4f6' }}>
            VoiceSpirit × DeepSeek
          </span>
          <span className={styles.statusPill}>
            <span
              className={`${styles.statusDot} ${
                state.phase === 'connecting'
                  ? styles.dotConnecting
                  : isSpeaking
                  ? styles.dotSpeaking
                  : styles.dotListening
              }`}
            />
            {state.provider} · {state.voice}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <VoiceSettingsPopover
            options={{
              gatewayUrl: 'ws://127.0.0.1:8000/voice-chat/ws',
              provider: state.provider,
              model: state.model,
              voice: state.voice,
            }}
            onChange={(opt) => {
              void engine.stop()
              if (opt.provider) state.provider = opt.provider
              if (opt.model) state.model = opt.model
              if (opt.voice) state.voice = opt.voice
            }}
            t={t}
          />
          <button
            type="button"
            className={styles.actionBtn}
            onClick={onClose}
            title={t('minimize')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        <div
          className={`${styles.voiceOrb} ${!isSpeaking ? styles.voiceOrbListening : ''}`}
          style={{ transform: `scale(${orbScale})` }}
        />
      </div>

      {/* Live Transcript Stream */}
      <div className={styles.immersiveSubtitles}>
        {historyTurns.slice(-4).map((turn) => (
          <React.Fragment key={turn.id}>
            <div className={styles.userSubtitle}>{turn.userText}</div>
            <div className={styles.aiSubtitle}>{turn.assistantText}</div>
          </React.Fragment>
        ))}

        {currentUserText && (
          <div className={styles.userSubtitle} style={{ opacity: isUserInterim ? 0.7 : 1 }}>
            {currentUserText}
          </div>
        )}

        {currentAssistantText && (
          <div className={styles.aiSubtitle}>
            {currentAssistantText}
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className={styles.immersiveFooter}>
        {/* Mute Button */}
        <button
          type="button"
          className={`${styles.actionBtn} ${state.isMuted ? styles.actionBtnMuted : ''}`}
          style={{ width: 44, height: 44, borderRadius: 22 }}
          onClick={onToggleMute}
          title={state.isMuted ? t('unmute') : t('mute')}
        >
          {state.isMuted ? (
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
            onClick={onInterrupt}
            title={t('interrupt')}
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
            onClose()
            onEndCall()
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="14" height="14" x="5" y="5" rx="2" fill="currentColor" />
          </svg>
          <span>{t('endVoiceCall')}</span>
        </button>
      </div>
    </div>
  )
}
