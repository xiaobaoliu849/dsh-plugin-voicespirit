import React, { useState, useEffect } from 'react'
import type { VoiceAudioEngine, VoiceEngineState } from '../engine/VoiceAudioEngine.ts'
import { VoiceNativeComposer } from './VoiceNativeComposer.tsx'

export interface VoiceNativeComposerWrapProps {
  t: (k: any) => string
  getEngine: () => VoiceAudioEngine
  getState: () => VoiceEngineState
  getMicLevel: () => number
  getSpeakerLevel: () => number
  getCurrentUserText: () => string
  getIsUserInterim: () => boolean
  getCurrentAssistantText: () => string
  subscribe: (cb: () => void) => () => void
}

export const VoiceNativeComposerWrap: React.FC<VoiceNativeComposerWrapProps> = ({
  t,
  getEngine,
  getState,
  getMicLevel,
  getSpeakerLevel,
  getCurrentUserText,
  getIsUserInterim,
  getCurrentAssistantText,
  subscribe,
}) => {
  const [, setTick] = useState(0)

  useEffect(() => {
    return subscribe(() => setTick((v) => v + 1))
  }, [subscribe])

  const state = getState()
  const engine = getEngine()

  return (
    <VoiceNativeComposer
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
  )
}
