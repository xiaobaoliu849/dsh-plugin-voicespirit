import React from 'react'
import type { VoiceSpiritInjectedActions } from '../slots.ts'
import styles from './VoiceCall.module.css'

interface VoiceFloatingTriggerProps {
  actions: VoiceSpiritInjectedActions
  t: (k: any) => string
}

export const VoiceFloatingTrigger: React.FC<VoiceFloatingTriggerProps> = ({ actions, t }) => {
  const isCallActive = actions.isCallActive

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '84px',
        zIndex: 9990,
      }}
    >
      <button
        className={`${styles.voiceButton} ${isCallActive ? styles.voiceButtonActive : ''}`}
        style={{
          padding: '8px 14px',
          borderRadius: '24px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          background: isCallActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(30, 32, 40, 0.95)',
          backdropFilter: 'blur(12px)',
          border: isCallActive ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.18)',
          cursor: 'pointer',
        }}
        onClick={() => {
          if (isCallActive) {
            actions.endCall()
          } else {
            actions.startCall()
          }
        }}
        title={isCallActive ? t('endVoiceCall') : t('startVoiceCall')}
      >
        <svg
          className={styles.voiceIcon}
          style={{ width: 18, height: 18, color: isCallActive ? '#f87171' : '#60a5fa' }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
        <span style={{ fontWeight: 600, fontSize: 13, color: isCallActive ? '#fca5a5' : '#f3f4f6' }}>
          {isCallActive ? t('endVoiceCall') : t('voiceCall')}
        </span>
      </button>
    </div>
  )
}
