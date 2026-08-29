/**
 * VoiceDialogueStream: Full-width live & historical conversation stream
 * displayed in the main viewport during voice sessions.
 * Renders high-fidelity user/assistant chat bubbles matching the DeepSeek Harness
 * design language, with streaming animations and auto-scroll.
 */

import React, { useEffect, useRef, useState } from 'react'
import type { VoiceSpiritController, VoiceSpiritUiState } from '../voice-controller.ts'
import type { VoiceSpiritKey } from '../locales.ts'
import styles from './VoiceCall.module.css'

export interface VoiceDialogueStreamProps {
  snapshot: VoiceSpiritUiState
  controller: VoiceSpiritController
  t: (key: VoiceSpiritKey) => string
}

export const VoiceDialogueStream: React.FC<VoiceDialogueStreamProps> = ({
  snapshot,
  controller,
  t,
}) => {
  const { engine } = snapshot
  const bottomAnchorRef = useRef<HTMLDivElement>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const providerLabel = [engine.provider || 'DashScope', engine.voice || 'Default']
    .filter(Boolean)
    .join(' · ')

  // Auto-scroll to latest turn or streaming word
  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [snapshot.historyTurns.length, snapshot.userText, snapshot.assistantText, engine.phase])

  const copyText = (text: string, id: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => { setCopiedId(null) }, 1800)
    })
  }

  const formatTime = (ts?: number) => {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const isTranslateMode = snapshot.activeVoiceMode === 'translate'
  const isError = engine.phase === 'error'
  const errorKey = controller.errorKey()
  const errorText = isError
    ? (errorKey !== undefined ? t(errorKey) : t('statusError'))
      + (engine.errorMessage ? ` — ${engine.errorMessage}` : '')
    : ''

  const providerHelpText = engine.provider === 'DashScope'
    ? t('voiceHelpDashScope')
    : engine.provider === 'Google'
    ? t('voiceHelpGoogle')
    : engine.provider === 'Doubao'
    ? t('voiceHelpDoubao')
    : engine.provider === 'OpenAI'
    ? t('voiceHelpOpenAI')
    : engine.provider === 'Cartesia'
    ? t('voiceHelpCartesia')
    : ''

  const hasAnyContent = isError
    || snapshot.historyTurns.length > 0
    || snapshot.userText.trim().length > 0
    || snapshot.assistantText.trim().length > 0
    || snapshot.translationText.trim().length > 0

  if (!hasAnyContent) return null

  return (
    <div className={styles.dialogueStreamContainer}>
      <div className={styles.dialogueStreamHeader}>
        <div className={styles.dialogueStreamTitle}>
          <span className={styles.dialogueStatusDot} />
          <span>{isTranslateMode ? '🌐 实时双向同传口译' : '🎙️ 实时语音对话'}</span>
          <span className={styles.dialogueProviderBadge}>
            {isTranslateMode ? `${snapshot.sourceLanguage.toUpperCase()} ⇄ ${snapshot.targetLanguage.toUpperCase()}` : providerLabel}
          </span>
        </div>
      </div>

      <div className={styles.dialogueMessagesList}>
        {/* In-stream rich error diagnostic card */}
        {isError && (
          <div className={styles.dialogueErrorCard}>
            <div className={styles.dialogueErrorHeader}>
              <span>⚠️</span>
              <span>{t('missingCredentialsTitle')} / {t('statusError')}</span>
            </div>
            <div className={styles.dialogueErrorMessage}>
              {errorText}
            </div>
            {providerHelpText && (
              <div style={{ fontSize: '11.5px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.08)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                💡 {providerHelpText}
              </div>
            )}
            <div className={styles.dialogueErrorTips}>
              <span style={{ fontWeight: 600, color: 'var(--dsw-alias-label-primary, #e5e7eb)' }}>{t('connectionTroubleshooting')}：</span>
              <span>{t('tipCheckKeys')}</span>
              <span>{t('tipCheckNetwork')}</span>
              <span>{t('tipSwitchProvider')}</span>
            </div>
            <div className={styles.dialogueErrorActions}>
              <button
                type="button"
                className={`${styles.dialogueErrorBtn} ${styles.dialogueErrorBtnPrimary}`}
                onClick={() => { controller.requestOpenSettings() }}
              >
                ⚙️ {t('configureKey')}
              </button>
              <button
                type="button"
                className={styles.dialogueErrorBtn}
                onClick={() => { void controller.startCall() }}
              >
                🔄 {t('retry')}
              </button>
              <button
                type="button"
                className={styles.dialogueErrorBtn}
                onClick={() => { controller.endCall() }}
              >
                ✕ {t('endVoiceCall')}
              </button>
            </div>
          </div>
        )}
        {/* Completed history turns */}
        {snapshot.historyTurns.map((turn, index) => {
          const isBilingualTurn = Boolean(turn.translationText)
          return (
            <React.Fragment key={turn.id || `turn_${index}`}>
              {/* User spoken turn (or bilingual pair in translate mode) */}
              {turn.userText && (
                <div className={styles.dialogueRowUser}>
                  <div className={styles.dialogueBubbleUser}>
                    <div className={styles.dialogueMeta}>
                      <span className={styles.dialogueAuthor}>🎙 您 {isBilingualTurn ? `(${turn.sourceLanguage || '源语言'})` : ''}</span>
                      <div className={styles.dialogueActions}>
                        <span className={styles.dialogueTime}>{formatTime(turn.timestamp)}</span>
                        {isBilingualTurn && (
                          <button
                            type="button"
                            className={styles.dialogueCopyBtn}
                            onClick={() => { copyText(`${turn.userText}\n${turn.translationText}`, turn.id) }}
                            title={copiedId === turn.id ? t('copiedBilingual') : t('copyBilingual')}
                          >
                            {copiedId === turn.id ? '✓ 已复制' : t('copyBilingual')}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={styles.dialogueBody}>
                      <div className={styles.dialogueSourceBlock}>{turn.userText}</div>
                      {turn.translationText && (
                        <div className={styles.dialogueTranslationBlock}>
                          <div className={styles.dialogueTranslationLabel}>
                            <span>🌐 译文 ({turn.targetLanguage || '目标语言'})</span>
                          </div>
                          <div className={styles.dialogueTranslationContent}>{turn.translationText}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Standard assistant reply when not in pure translation turn */}
              {turn.assistantText && !turn.translationText && (
                <div className={styles.dialogueRowAssistant}>
                  <div className={styles.dialogueBubbleAssistant}>
                    <div className={styles.dialogueMeta}>
                      <span className={styles.dialogueAuthor}>✨ 助手 ({providerLabel})</span>
                      <div className={styles.dialogueActions}>
                        <span className={styles.dialogueTime}>{formatTime(turn.timestamp)}</span>
                        <button
                          type="button"
                          className={styles.dialogueCopyBtn}
                          onClick={() => { copyText(turn.assistantText, turn.id) }}
                          title={copiedId === turn.id ? '已复制' : '复制回答'}
                        >
                          {copiedId === turn.id ? '✓ 已复制' : '复制'}
                        </button>
                      </div>
                    </div>
                    <div className={styles.dialogueBody}>{turn.assistantText}</div>
                  </div>
                </div>
              )}
            </React.Fragment>
          )
        })}

        {/* In-flight streaming turn: User live transcription & translation */}
        {(snapshot.userText || snapshot.translationText) && (
          <div className={styles.dialogueRowUser}>
            <div className={`${styles.dialogueBubbleUser} ${styles.dialogueBubbleStreaming}`}>
              <div className={styles.dialogueMeta}>
                <span className={styles.dialogueAuthor}>
                  {isTranslateMode ? '🌐 实时同传识别中…' : '🎙 您 (实时转写中...)'}
                </span>
              </div>
              <div className={styles.dialogueBody}>
                {snapshot.userText && (
                  <div className={styles.dialogueSourceBlock}>
                    {snapshot.userText}
                    {!snapshot.translationText && <span className={styles.streamCursor} />}
                  </div>
                )}
                {snapshot.translationText && (
                  <div className={styles.dialogueTranslationBlock}>
                    <div className={styles.dialogueTranslationLabel}>
                      <span>🌐 实时译文 ({snapshot.targetLanguage.toUpperCase()})</span>
                    </div>
                    <div className={styles.dialogueTranslationContent}>
                      {snapshot.translationText}
                      <span className={styles.streamCursor} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* In-flight streaming turn: Assistant live reply */}
        {snapshot.assistantText && (
          <div className={styles.dialogueRowAssistant}>
            <div className={`${styles.dialogueBubbleAssistant} ${styles.dialogueBubbleStreaming}`}>
              <div className={styles.dialogueMeta}>
                <span className={styles.dialogueAuthor}>✨ 助手 ({providerLabel}) 正在回答...</span>
                <div className={styles.dialogueActions}>
                  <button
                    type="button"
                    className={styles.dialogueCopyBtn}
                    onClick={() => { copyText(snapshot.assistantText, 'live_assistant') }}
                    title={copiedId === 'live_assistant' ? '已复制' : '复制回答'}
                  >
                    {copiedId === 'live_assistant' ? '✓ 已复制' : '复制'}
                  </button>
                </div>
              </div>
              <div className={styles.dialogueBody}>
                {snapshot.assistantText}
                <span className={styles.streamCursor} />
              </div>
            </div>
          </div>
        )}

        {/* Ambient status hint when silent */}
        {engine.phase === 'listening' && !snapshot.userText && !snapshot.assistantText && !snapshot.translationText && (
          <div className={styles.dialogueListeningHint}>
            <span className={styles.listeningWaveAnimation} />
            <span>{isTranslateMode ? '同传准备就绪，请直接说任意语言…' : '正在聆听中，请直接说话...'}</span>
          </div>
        )}

        {engine.phase === 'speaking' && !snapshot.assistantText && !snapshot.translationText && (
          <div className={styles.dialogueListeningHint}>
            <span className={styles.speakingWaveAnimation} />
            <span>AI 正在播报中...</span>
          </div>
        )}

        <div ref={bottomAnchorRef} style={{ height: 1 }} />
      </div>
    </div>
  )
}
