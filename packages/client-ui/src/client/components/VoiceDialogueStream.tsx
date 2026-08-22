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

  const hasAnyContent = snapshot.historyTurns.length > 0
    || snapshot.userText.trim().length > 0
    || snapshot.assistantText.trim().length > 0
    || engine.phase !== 'idle'

  if (!hasAnyContent) return null

  return (
    <div className={styles.dialogueStreamContainer}>
      <div className={styles.dialogueStreamHeader}>
        <div className={styles.dialogueStreamTitle}>
          <span className={styles.dialogueStatusDot} />
          <span>{t('pluginName')} 实时语音对话</span>
          <span className={styles.dialogueProviderBadge}>{providerLabel}</span>
        </div>
      </div>

      <div className={styles.dialogueMessagesList}>
        {/* Completed history turns */}
        {snapshot.historyTurns.map((turn, index) => (
          <React.Fragment key={turn.id || `turn_${index}`}>
            {turn.userText && (
              <div className={styles.dialogueRowUser}>
                <div className={styles.dialogueBubbleUser}>
                  <div className={styles.dialogueMeta}>
                    <span className={styles.dialogueAuthor}>🎙 您</span>
                    <span className={styles.dialogueTime}>{formatTime(turn.timestamp)}</span>
                  </div>
                  <div className={styles.dialogueBody}>{turn.userText}</div>
                </div>
              </div>
            )}

            {turn.assistantText && (
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
        ))}

        {/* In-flight streaming turn: User live transcription */}
        {snapshot.userText && (
          <div className={styles.dialogueRowUser}>
            <div className={`${styles.dialogueBubbleUser} ${styles.dialogueBubbleStreaming}`}>
              <div className={styles.dialogueMeta}>
                <span className={styles.dialogueAuthor}>🎙 您 (实时转写中...)</span>
              </div>
              <div className={styles.dialogueBody}>
                {snapshot.userText}
                <span className={styles.streamCursor} />
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
        {engine.phase === 'listening' && !snapshot.userText && !snapshot.assistantText && (
          <div className={styles.dialogueListeningHint}>
            <span className={styles.listeningWaveAnimation} />
            <span>正在聆听中，请直接说话...</span>
          </div>
        )}

        {engine.phase === 'speaking' && !snapshot.assistantText && (
          <div className={styles.dialogueListeningHint}>
            <span className={styles.speakingWaveAnimation} />
            <span>AI 正在组织回答并播报...</span>
          </div>
        )}

        <div ref={bottomAnchorRef} style={{ height: 1 }} />
      </div>
    </div>
  )
}
