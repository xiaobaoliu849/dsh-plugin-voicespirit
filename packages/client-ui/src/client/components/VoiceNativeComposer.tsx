import React, { useState, useRef } from 'react'
import type { VoiceAudioEngine, VoiceEngineState } from '../engine/VoiceAudioEngine.ts'
import { VoiceSettingsPopover } from './VoiceSettingsPopover.tsx'
import styles from './VoiceCall.module.css'

export interface VoiceNativeComposerProps {
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

export const VoiceNativeComposer: React.FC<VoiceNativeComposerProps> = ({
  engine,
  state,
  micLevel,
  speakerLevel,
  currentUserText,
  isUserInterim,
  currentAssistantText,
  onEndCall,
  onToggleMute,
  onInterrupt,
  t,
}) => {
  const isSpeaking = state.phase === 'speaking' || speakerLevel > 0.05
  const activeLevel = isSpeaking ? speakerLevel : micLevel
  const [inputText, setInputText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 8 dynamic wave bars
  const waveHeights = [
    6 + Math.min(18, activeLevel * 20),
    10 + Math.min(22, activeLevel * 30),
    16 + Math.min(26, activeLevel * 45),
    20 + Math.min(30, activeLevel * 60),
    16 + Math.min(26, activeLevel * 45),
    10 + Math.min(22, activeLevel * 30),
    6 + Math.min(18, activeLevel * 20),
    4 + Math.min(14, activeLevel * 15),
  ]

  const handleSendText = () => {
    if (inputText.trim()) {
      engine.sendText(inputText.trim())
      setInputText('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendText()
    }
  }

  // Voice title label
  const voiceLabel = `${state.provider} / ${state.model.includes('cartesia') ? 'DeepSeek-V3' : state.model} · ${state.voice.slice(0, 8)}`

  return (
    <div className={styles.vsIntegratedCard} data-composer-card="">
      {/* ── Top Header Ribbon (VoiceSpirit Connected Banner) ── */}
      <div className={styles.vsCardHeader}>
        <div className={styles.vsHeaderLeft}>
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
              {state.phase === 'connecting'
                ? '正在建立连接...'
                : state.phase === 'interrupted'
                ? '已打断'
                : '已连接，您可以说话或打字'}
            </span>
          </div>

          <div className={styles.vsModelBadge} title={voiceLabel}>
            {voiceLabel}
          </div>
        </div>

        <div className={styles.vsHeaderRight}>
          {/* Realtime Waveform */}
          <div className={styles.vsWaveform} title={isSpeaking ? 'AI 正在回复' : '正在倾听...'}>
            {waveHeights.map((h, i) => (
              <div
                key={i}
                className={`${styles.vsWaveBar} ${isSpeaking ? styles.vsWaveBarAI : styles.vsWaveBarMic}`}
                style={{ height: `${h}px` }}
              />
            ))}
          </div>

          {/* End Call Button */}
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

      {/* ── Center Live Interaction Area (Live Subtitle / Text Input) ── */}
      <div className={styles.vsCardBody}>
        {/* Live Subtitle Ticker when active */}
        {(currentUserText || currentAssistantText) && (
          <div className={styles.vsLiveTicker}>
            {currentAssistantText ? (
              <span className={styles.vsAITicker}>
                <strong>AI: </strong>
                {currentAssistantText}
              </span>
            ) : (
              <span className={`${styles.vsUserTicker} ${isUserInterim ? styles.transcriptInterim : ''}`}>
                <strong>您: </strong>
                {currentUserText}
              </span>
            )}
          </div>
        )}

        <textarea
          ref={textareaRef}
          className={styles.vsTextarea}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="正在实时通话中：可直接说话，或输入文字/粘贴图片发送..."
          rows={2}
        />
      </div>

      {/* ── Bottom Controls Toolbar ── */}
      <div className={styles.vsCardFooter}>
        <div className={styles.vsFooterLeft}>
          {/* Mute Button */}
          <button
            type="button"
            className={`${styles.actionBtn} ${state.isMuted ? styles.actionBtnMuted : ''}`}
            onClick={onToggleMute}
            title={state.isMuted ? t('unmute') : t('mute')}
          >
            {state.isMuted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            )}
            <span style={{ marginLeft: 5 }}>{state.isMuted ? '已静音' : '麦克风开启'}</span>
          </button>

          {/* Interrupt Button (When AI is speaking) */}
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
              <span style={{ marginLeft: 5 }}>打断</span>
            </button>
          )}
        </div>

        <div className={styles.vsFooterRight}>
          {/* Provider Settings */}
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

          {/* Send Text Button */}
          <button
            type="button"
            className={styles.vsSendBtn}
            disabled={!inputText.trim()}
            onClick={handleSendText}
            title="发送文本"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8.3125 0.980183C8.66767 1.0531 8.97902 1.20418 9.2627 1.43233C9.48724 1.61297 9.73029 1.85793 9.97949 2.10714L14.707 6.83468L13.293 8.24874L9 3.95577V15.0417H7V3.95577L2.70703 8.24874L1.29297 6.83468L6.02051 2.10714C6.26971 1.85793 6.51277 1.61297 6.7373 1.43233C6.97662 1.23986 7.28445 1.04402 7.6875 0.980183C7.8973 0.947006 8.1031 0.95516 8.3125 0.980183Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
