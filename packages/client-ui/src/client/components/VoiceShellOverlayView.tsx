import React, { useState, useEffect } from 'react'
import type { VoiceAudioEngine, VoiceEngineState, VoiceTranscriptTurn } from '../engine/VoiceAudioEngine.ts'
import type { VoiceSpiritInjectedActions } from '../slots.ts'
import { VoiceCallImmersiveModal } from './VoiceCallImmersiveModal.tsx'

export interface VoiceShellOverlayViewProps {
  t: (k: any) => string
  getEngine: () => VoiceAudioEngine
  getState: () => VoiceEngineState
  getActions: () => VoiceSpiritInjectedActions
  getMicLevel: () => number
  getSpeakerLevel: () => number
  getCurrentUserText: () => string
  getIsUserInterim: () => boolean
  getCurrentAssistantText: () => string
  getHistoryTurns: () => VoiceTranscriptTurn[]
  isImmersiveOpen: boolean
  setImmersiveOpen: (open: boolean) => void
  subscribe: (cb: () => void) => () => void
}

export const VoiceShellOverlayView: React.FC<VoiceShellOverlayViewProps> = ({
  t,
  getEngine,
  getState,
  getMicLevel,
  getSpeakerLevel,
  getCurrentUserText,
  getIsUserInterim,
  getCurrentAssistantText,
  getHistoryTurns,
  isImmersiveOpen,
  setImmersiveOpen,
  subscribe,
}) => {
  const [, setTick] = useState(0)

  useEffect(() => {
    return subscribe(() => setTick((v) => v + 1))
  }, [subscribe])

  const state = getState()
  const engine = getEngine()
  const isCallActive = state.isConnected || state.phase !== 'idle'

  // Only render immersive modal when user explicitly triggers full immersion
  if (!isCallActive || !isImmersiveOpen) {
    return null
  }

  return (
    <VoiceCallImmersiveModal
      engine={engine}
      state={state}
      micLevel={getMicLevel()}
      speakerLevel={getSpeakerLevel()}
      currentUserText={getCurrentUserText()}
      isUserInterim={getIsUserInterim()}
      currentAssistantText={getCurrentAssistantText()}
      historyTurns={getHistoryTurns()}
      onClose={() => setImmersiveOpen(false)}
      onEndCall={() => {
        setImmersiveOpen(false)
        engine.stop()
      }}
      onToggleMute={() => engine.toggleMute()}
      onInterrupt={() => engine.interrupt()}
      t={t}
    />
  )
}
