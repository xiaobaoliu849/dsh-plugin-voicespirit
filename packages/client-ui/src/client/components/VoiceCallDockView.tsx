/**
 * The native integrated stage stacked directly above the composer:
 * 1. VoiceDialogueStream: Full live conversation bubble stream in the main viewport
 * 2. VoiceCallDockBar: A compact 42px status bar with live waveform and quick controls
 * 3. Immersive full-screen modal view
 *
 * When a voice call is active, data-voicespirit-active snaps the input bar down to the bottom.
 * The voice conversation stays inside the dock: hanging up never writes into
 * the native conversation composer — voice turns belong to the voice session,
 * not to the harness agent.
 */

import React, { useEffect, useState } from 'react'
import type { VoiceSpiritController, VoiceSpiritUiState } from '../voice-controller.ts'
import type { VoiceSpiritKey } from '../locales.ts'
import { VoiceDialogueStream } from './VoiceDialogueStream.tsx'
import { VoiceCallDockBar } from './VoiceCallDockBar.tsx'
import { VoiceCallImmersiveModal } from './VoiceCallImmersiveModal.tsx'
import styles from './VoiceCall.module.css'

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
  const callLive = engine.phase !== 'idle' || snapshot.launching
  const hasHistory = snapshot.historyTurns.length > 0

  return (
    <div
      data-voicespirit-active={callLive || hasHistory ? 'true' : undefined}
      className={styles.dockViewRoot}
    >
      {/* 1. Main Viewport Dialogue Bubbles Stream */}
      {(callLive || hasHistory) && (
        <VoiceDialogueStream
          snapshot={snapshot}
          controller={controller}
          t={t}
        />
      )}

      {/* 2. Compact 42px Active Dock Ribbon */}
      {callLive && (
        <VoiceCallDockBar snapshot={snapshot} controller={controller} t={t} />
      )}

      {/* 3. Immersive full-screen call view */}
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
