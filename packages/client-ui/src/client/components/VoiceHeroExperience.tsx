import React from 'react'
import type { VoiceEngineState, VoiceTranscriptTurn } from '../engine/VoiceAudioEngine.ts'
import styles from './VoiceCall.module.css'

export interface VoiceHeroExperienceProps {
  state: VoiceEngineState
  micLevel: number
  speakerLevel: number
  turns: VoiceTranscriptTurn[]
  currentUserText: string
  isUserInterim: boolean
  currentAssistantText: string
  currentTranslationText?: string
}

export const VoiceHeroExperience: React.FC<VoiceHeroExperienceProps> = ({
  state,
  micLevel,
  speakerLevel,
  turns,
  currentUserText,
  isUserInterim,
  currentAssistantText,
  currentTranslationText,
}) => {
  const isSpeaking = state.phase === 'speaking' || speakerLevel > 0.05
  const activeLevel = isSpeaking ? speakerLevel : micLevel
  const orbScale = 1 + Math.min(0.35, activeLevel * 0.75)

  return (
    <div className={styles.nativeHeroContainer}>
      {/* Dynamic Glowing Organic Voice Orb */}
      <div className={styles.nativeOrbWrapper}>
        <div
          className={styles.nativeOrbAmbient}
          style={{
            transform: `scale(${1 + activeLevel * 1.5})`,
            opacity: 0.25 + activeLevel * 0.75,
            background: isSpeaking
              ? 'radial-gradient(circle, rgba(244, 63, 94, 0.48) 0%, rgba(249, 115, 22, 0.25) 50%, transparent 75%)'
              : 'radial-gradient(circle, rgba(251, 146, 60, 0.48) 0%, rgba(245, 158, 11, 0.22) 50%, transparent 75%)',
          }}
        />
        {/* Scale rides a wrapper layer: the orb's own transform is owned by
            the rotate animation, which would override an inline scale. */}
        <div
          style={{
            transform: `scale(${orbScale})`,
            transition: 'transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)',
            display: 'flex',
            zIndex: 1,
          }}
        >
          <div className={`${styles.voiceOrb} ${!isSpeaking ? styles.voiceOrbListening : ''}`} />
        </div>
        <div className={styles.orbRing} />
      </div>

      {/* Realtime Conversation Turns History & Live Bubble */}
      <div className={styles.nativeTurnStream}>
        {turns.slice(-3).map((turn) => (
          <div key={turn.id} className={styles.turnPair}>
            {turn.userText && (
              <div className={styles.nativeUserBubble}>
                <span>{turn.userText}</span>
              </div>
            )}
            {turn.translationText && (
              <div className={styles.nativeAssistantBubble} style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(251, 191, 36, 0.14) 100%)', borderColor: 'rgba(251, 191, 36, 0.35)', color: '#fef08a' }}>
                <span>🌐 {turn.translationText}</span>
              </div>
            )}
            {turn.assistantText && !turn.translationText && (
              <div className={styles.nativeAssistantBubble}>
                <span>{turn.assistantText}</span>
              </div>
            )}
          </div>
        ))}

        {currentUserText && (
          <div className={`${styles.nativeUserBubble} ${isUserInterim ? styles.bubbleInterim : ''}`}>
            <span>{currentUserText}</span>
          </div>
        )}

        {currentTranslationText && (
          <div className={styles.nativeAssistantBubble} style={{ background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(59, 130, 246, 0.2) 100%)', borderColor: 'rgba(56, 189, 248, 0.35)' }}>
            <span>🌐 {currentTranslationText}</span>
          </div>
        )}

        {currentAssistantText && !currentTranslationText && (
          <div className={styles.nativeAssistantBubble}>
            <span>{currentAssistantText}</span>
          </div>
        )}
      </div>
    </div>
  )
}
