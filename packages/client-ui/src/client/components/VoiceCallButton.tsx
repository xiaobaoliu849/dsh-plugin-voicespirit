import React from 'react'
import type { VoiceCallButtonProps } from '../slots.ts'
import styles from './VoiceCall.module.css'

export const VoiceCallHeaderButton: React.FC<VoiceCallButtonProps> = (props) => {
  const actions = props.actions
  const isCallActive = actions?.isCallActive || false
  const t = (props as any).t || ((k: string) => k)

  return (
    <button
      type="button"
      className={`${styles.toolMicBtn} ${isCallActive ? styles.toolMicBtnActive : ''}`}
      onClick={() => {
        if (isCallActive) {
          actions?.endCall()
        } else {
          actions?.startCall()
        }
      }}
      title={isCallActive ? t('endVoiceCall') : t('startVoiceCall')}
      aria-label={isCallActive ? t('endVoiceCall') : t('startVoiceCall')}
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
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    </button>
  )
}
