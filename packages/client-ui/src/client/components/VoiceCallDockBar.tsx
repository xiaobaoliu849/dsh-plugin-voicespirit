import React from 'react'
import type { VoiceAudioEngine, VoiceEngineState } from '../engine/VoiceAudioEngine.ts'
import { VoiceSettingsPopover } from './VoiceSettingsPopover.tsx'
import styles from './VoiceCall.module.css'

interface VoiceCallDockBarProps {
  engine: VoiceAudioEngine
  state: VoiceEngineState
  micLevel: number
  speakerLevel: number
  currentUserText: string
  isUserInterim: boolean
  currentAssistantText: string
  onEndCall: () => void
  onToggleMute: () => void
  onInterrupt: () => void
  t: (k: any) => string
}

export const VoiceCallDockBar: React.FC<VoiceCallDockBarProps> = ({
  engine,
  state,
  micLevel,
  speakerLevel,
  currentUserText,
  isUserInterim: _isUserInterim,
  currentAssistantText,
  onEndCall,
  onToggleMute,
  onInterrupt,
  t,
}) => {
  const isSpeaking = state.phase === 'speaking' || speakerLevel > 0.05
  const activeLevel = isSpeaking ? speakerLevel : micLevel

  // 8 soundwave bars dynamically reacting to audio
  const waveHeights = [
    5 + Math.min(16, activeLevel * 20),
    8 + Math.min(20, activeLevel * 30),
    12 + Math.min(24, activeLevel * 45),
    16 + Math.min(28, activeLevel * 60),
    12 + Math.min(24, activeLevel * 45),
    8 + Math.min(20, activeLevel * 30),
    5 + Math.min(16, activeLevel * 20),
    4 + Math.min(12, activeLevel * 15),
  ]

  const providerLabel = `${state.provider} / ${
    state.model.includes('cartesia') ? 'DeepSeek-V3' : state.model
  } · ${state.voice.slice(0, 8)}`

  return (
    <div className={styles.vsDockRibbon}>
      <div className={styles.vsDockLeft}>
        {/* Status Indicator */}
        <div className={styles.vsStatusPill}>
          <span
            className={`${styles.statusDot} ${
              state.phase === 'connecting'
                ? styles.dotConnecting
                : state.phase === 'interrupted'
                ? styles.dotInterrupted
                : isSpeaking
                ? styles.dotSpeaking
                : styles.dotListening
            }`}
          />
          <span className={styles.vsStatusText}>
            {currentAssistantText
              ? `AI: ${currentAssistantText}`
              : currentUserText
              ? `您: ${currentUserText}`
              : state.phase === 'connecting'
              ? '正在建立连接...'
              : state.phase === 'interrupted'
              ? '已打断'
              : isSpeaking
              ? 'DeepSeek 正在回复...'
              : '正在聆听，您可以说话或打字...'}
          </span>
        </div>

        {/* Model Tag */}
        <div className={styles.vsModelBadge} title={providerLabel}>
          {providerLabel}
        </div>
      </div>

      <div className={styles.vsDockRight}>
        {/* Dynamic Jumping Waveform */}
        <div className={styles.vsWaveform} title={isSpeaking ? 'AI 正在回复' : '正在倾听...'}>
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
          className={`${styles.actionBtn} ${state.isMuted ? styles.actionBtnMuted : ''}`}
          onClick={onToggleMute}
          title={state.isMuted ? t('unmute') : t('mute')}
        >
          {state.isMuted ? (
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
            onClick={onInterrupt}
            title={t('interrupt')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          </button>
        )}

        {/* Voice & Provider Settings */}
        <VoiceSettingsPopover
          options={{
            gatewayUrl: engine.getGatewayUrl(),
            provider: state.provider,
            model: state.model,
            voice: state.voice,
            token: state.token,
            apiKey: state.apiKey,
          }}
          onChange={(opt) => {
            engine.updateOptions(opt)
          }}
          t={t}
        />

        {/* Hang Up Button (VoiceSpirit Exact Red Badge) */}
        <button
          type="button"
          className={styles.vsHangupBtn}
          onClick={onEndCall}
          title={t('endVoiceCall')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect width="14" height="14" x="5" y="5" rx="2" />
          </svg>
          <span>{t('endVoiceCall')}</span>
        </button>
      </div>
    </div>
  )
}
