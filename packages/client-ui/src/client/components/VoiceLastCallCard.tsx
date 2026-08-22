/**
 * The ended-call review card: the transcript of the call that just finished,
 * kept on screen until dismissed or redialed, with one-click copy. Turns wear
 * the same bubble styles as the live stage so the hand-off reads continuous.
 */

import React, { useState } from 'react'
import type { VoiceLastCall, VoiceSpiritController } from '../voice-controller.ts'
import type { VoiceSpiritKey } from '../locales.ts'
import styles from './VoiceCall.module.css'

export interface VoiceLastCallCardProps {
  lastCall: VoiceLastCall
  controller: VoiceSpiritController
  t: (key: VoiceSpiritKey) => string
}

export const VoiceLastCallCard: React.FC<VoiceLastCallCardProps> = ({
  lastCall,
  controller,
  t,
}) => {
  const [copied, setCopied] = useState(false)

  const copyTranscript = (): void => {
    const text = lastCall.turns
      .map((turn) => {
        const interruptedNote = turn.interrupted === true ? ` (${t('interrupted')})` : ''
        return `${t('userSpeaking')}: ${turn.userText}\n${t('aiSpeaking')}: ${turn.assistantText}${interruptedNote}`
      })
      .join('\n\n')
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => { setCopied(false) }, 1600)
    }).catch(() => {})
  }

  return (
    <div className={styles.lastCallCard}>
      <div className={styles.lastCallHeader}>
        <span className={styles.lastCallTitle}>{t('lastCallTitle')}</span>
        <span className={styles.lastCallMeta}>
          {lastCall.turns.length} {t('turnsLabel')} · {new Date(lastCall.endedAt).toLocaleTimeString()}
        </span>
        <span className={styles.lastCallActions}>
          <button type="button" className={styles.actionBtn} onClick={copyTranscript}>
            {copied ? t('copied') : t('copyTranscript')}
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => { controller.dismissLastCall() }}
            title={t('close')}
            aria-label={t('close')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </span>
      </div>
      <div className={styles.lastCallTurns}>
        {lastCall.turns.map((turn) => (
          <div key={turn.id} className={styles.turnPair}>
            {turn.userText !== '' && (
              <div className={styles.nativeUserBubble}><span>{turn.userText}</span></div>
            )}
            {turn.assistantText !== '' && (
              <div className={styles.nativeAssistantBubble}><span>{turn.assistantText}</span></div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
