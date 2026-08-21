/**
 * Type-into-the-call row: sends one text turn through the live realtime
 * session for moments when speaking is not an option. Shown under the live
 * transcript in both the dock stage and the immersive view; disabled while
 * the socket is not open.
 */

import React, { useState } from 'react'
import type { VoiceSpiritController, VoiceSpiritUiState } from '../voice-controller.ts'
import type { VoiceSpiritKey } from '../locales.ts'
import styles from './VoiceCall.module.css'

export interface VoiceTextInputProps {
  snapshot: VoiceSpiritUiState
  controller: VoiceSpiritController
  t: (key: VoiceSpiritKey) => string
}

export const VoiceTextInput: React.FC<VoiceTextInputProps> = ({
  snapshot,
  controller,
  t,
}) => {
  const [value, setValue] = useState('')
  const connected = snapshot.engine.isConnected

  const submit = (): void => {
    // sendText clears the field only when the turn actually went out.
    if (controller.sendText(value)) setValue('')
  }

  return (
    <form
      className={styles.vsTextInputRow}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <input
        type="text"
        className={styles.vsTextInput}
        value={value}
        disabled={!connected}
        autoComplete="off"
        spellCheck={false}
        aria-label={t('typeMessage')}
        placeholder={t('typeMessage')}
        onChange={(e) => { setValue(e.target.value) }}
      />
      <button
        type="submit"
        className={styles.vsTextSendBtn}
        disabled={!connected || value.trim() === ''}
        title={t('send')}
        aria-label={t('send')}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      </button>
    </form>
  )
}
