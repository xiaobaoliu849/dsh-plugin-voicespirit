/**
 * The native integrated ribbon stacked directly above the composer:
 * a compact 42px status bar with live waveform, streaming transcript,
 * and quick controls. Expands to the immersive full-screen view upon request.
 */

import React, { useEffect, useState } from 'react'
import type { VoiceSpiritController, VoiceSpiritUiState } from '../voice-controller.ts'
import type { VoiceSpiritKey } from '../locales.ts'
import { VoiceCallDockBar } from './VoiceCallDockBar.tsx'
import { VoiceCallImmersiveModal } from './VoiceCallImmersiveModal.tsx'
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
        <VoiceCallDockBar snapshot={snapshot} controller={controller} t={t} />
      )}

      {/* Ended-call review card — the transcript survives the hang-up */}
      {!callLive && snapshot.lastCall !== undefined && (
        <VoiceLastCallCard
          lastCall={snapshot.lastCall}
          controller={controller}
          t={t}
        />
      )}

      {/* Immersive full-screen call view */}
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
