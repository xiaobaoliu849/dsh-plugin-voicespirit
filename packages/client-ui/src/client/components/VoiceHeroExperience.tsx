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
  t: (k: any) => string
}

export const VoiceHeroExperience: React.FC<VoiceHeroExperienceProps> = ({
  state,
  micLevel,
  speakerLevel,
  turns,
  currentUserText,
  isUserInterim,
  currentAssistantText,
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
              ? 'radial-gradient(circle, rgba(99, 102, 241, 0.45) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 75%)'
              : 'radial-gradient(circle, rgba(16, 185, 129, 0.45) 0%, rgba(6, 182, 212, 0.2) 50%, transparent 75%)',
          }}
        />
        <div
          className={`${styles.voiceOrb} ${!isSpeaking ? styles.voiceOrbListening : ''}`}
          style={{ transform: `scale(${orbScale})` }}
        />
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
            {turn.assistantText && (
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

        {currentAssistantText && (
          <div className={styles.nativeAssistantBubble}>
            <span>{currentAssistantText}</span>
          </div>
        )}
      </div>
    </div>
  )
}
