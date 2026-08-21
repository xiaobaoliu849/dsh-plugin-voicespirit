/**
 * The full-width row stacked above the composer: the audio orb + live turn
 * bubbles while a call is live, the dock ribbon, and the immersive full-screen
 * view when the user expands. Reads everything through the shared controller.
 */

import React, { useEffect, useState } from 'react'
import type { VoiceSpiritController, VoiceSpiritUiState } from '../voice-controller.ts'
import type { VoiceSpiritKey } from '../locales.ts'
import { VoiceHeroExperience } from './VoiceHeroExperience.tsx'
import { VoiceCallDockBar } from './VoiceCallDockBar.tsx'
import { VoiceCallImmersiveModal } from './VoiceCallImmersiveModal.tsx'
import { VoiceTextInput } from './VoiceTextInput.tsx'
import { VoiceLastCallCard } from './VoiceLastCallCard.tsx'

export interface VoiceCallDockViewProps {
  controller: VoiceSpiritController
  t: (key: VoiceSpiritKey) => string
}

export const VoiceCallDockView: React.FC<VoiceCallDockViewProps> = ({
  controller,
  t,
}) => {
  const [snapshot, setSnapshot] = useState<VoiceSpiritUiState>(() => controller.getSnapshot())

  useEffect(() => {
    setSnapshot(controller.getSnapshot())
    return controller.subscribe(() => { setSnapshot(controller.getSnapshot()) })
  }, [controller])

  const { engine } = snapshot
  // Render while a call is live OR while a backend start kicked by a call is
  // settling — a cold start can take tens of seconds and must not look dead.
  const callLive = engine.phase !== 'idle' || snapshot.launching

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
      {callLive && (
        <>
          {/* 1. Organic Voice Orb & Live Dialogue Bubbles */}
          <VoiceHeroExperience
            state={engine}
            micLevel={snapshot.micLevel}
            speakerLevel={snapshot.speakerLevel}
            turns={snapshot.historyTurns}
            currentUserText={snapshot.userText}
            isUserInterim={snapshot.isUserInterim}
            currentAssistantText={snapshot.assistantText}
            t={t}
          />

          {/* 2. Type-into-the-call row (hidden while the immersive view owns the screen) */}
          {!snapshot.immersiveOpen && (
            <VoiceTextInput snapshot={snapshot} controller={controller} t={t} />
          )}

          {/* 3. VoiceSpirit Integrated Top Ribbon */}
          <VoiceCallDockBar snapshot={snapshot} controller={controller} t={t} />
        </>
      )}

      {/* 4. Ended-call review card — the transcript survives the hang-up */}
      {!callLive && snapshot.lastCall !== undefined && (
        <VoiceLastCallCard
          lastCall={snapshot.lastCall}
          controller={controller}
          t={t}
        />
      )}

      {/* 5. Immersive full-screen call view */}
      {snapshot.immersiveOpen && callLive && (
        <VoiceCallImmersiveModal
          snapshot={snapshot}
          controller={controller}
          t={t}
        />
      )}
    </div>
  )
}
