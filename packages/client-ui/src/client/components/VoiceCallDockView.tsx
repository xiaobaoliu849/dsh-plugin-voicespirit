import React, { useState, useEffect } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { VoiceAudioEngine, VoiceEngineState, VoiceTranscriptTurn } from '../engine/VoiceAudioEngine.ts'
import { VoiceHeroExperience } from './VoiceHeroExperience.tsx'
import { VoiceCallDockBar } from './VoiceCallDockBar.tsx'

export interface VoiceCallDockViewProps {
  sessionId: SessionId
  t: (k: any) => string
  getEngine: () => VoiceAudioEngine
  getState: () => VoiceEngineState
  getMicLevel: () => number
  getSpeakerLevel: () => number
  getCurrentUserText: () => string
  getIsUserInterim: () => boolean
  getCurrentAssistantText: () => string
  getHistoryTurns: () => VoiceTranscriptTurn[]
  subscribe: (cb: () => void) => () => void
}

export const VoiceCallDockView: React.FC<VoiceCallDockViewProps> = ({
  t,
  getEngine,
  getState,
  getMicLevel,
  getSpeakerLevel,
  getCurrentUserText,
  getIsUserInterim,
  getCurrentAssistantText,
  getHistoryTurns,
  subscribe,
}) => {
  const [, setTick] = useState(0)

  useEffect(() => {
    return subscribe(() => setTick((v) => v + 1))
  }, [subscribe])

  const state = getState()
  if (!state.isConnected && state.phase === 'idle') {
    return null
  }

  const engine = getEngine()

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
      {/* 1. Organic Voice Orb & Live Dialogue Bubbles */}
      <VoiceHeroExperience
        state={state}
        micLevel={getMicLevel()}
        speakerLevel={getSpeakerLevel()}
        turns={getHistoryTurns()}
        currentUserText={getCurrentUserText()}
        isUserInterim={getIsUserInterim()}
        currentAssistantText={getCurrentAssistantText()}
        t={t}
      />

      {/* 2. VoiceSpirit Integrated Top Ribbon */}
      <VoiceCallDockBar
        engine={engine}
        state={state}
        micLevel={getMicLevel()}
        speakerLevel={getSpeakerLevel()}
        currentUserText={getCurrentUserText()}
        isUserInterim={getIsUserInterim()}
        currentAssistantText={getCurrentAssistantText()}
        onEndCall={() => engine.stop()}
        onToggleMute={() => engine.toggleMute()}
        onInterrupt={() => engine.interrupt()}
        t={t}
      />
    </div>
  )
}
