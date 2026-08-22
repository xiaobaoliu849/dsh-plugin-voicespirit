/**
 * The native integrated stage stacked directly above the composer:
 * 1. VoiceDialogueStream: Full live conversation bubble stream in the main viewport
 * 2. VoiceCallDockBar: A compact 42px status bar with live waveform and quick controls
 * 3. Immersive full-screen modal view
 *
 * When a voice call is active, data-voicespirit-active snaps the input bar down to the bottom.
 * When a voice call ends, turns seamlessly bridge into the conversation.
 */

import React, { useEffect, useState, useRef } from 'react'
import type { VoiceSpiritController, VoiceSpiritUiState } from '../voice-controller.ts'
import type { VoiceSpiritKey } from '../locales.ts'
import { VoiceDialogueStream } from './VoiceDialogueStream.tsx'
import { VoiceCallDockBar } from './VoiceCallDockBar.tsx'
import { VoiceCallImmersiveModal } from './VoiceCallImmersiveModal.tsx'
import styles from './VoiceCall.module.css'

export interface VoiceCallDockViewProps {
  controller: VoiceSpiritController
  t: (key: VoiceSpiritKey) => string
  inputActions?: {
    setDraft: (text: string) => void
    submit: () => void
  }
}

export const VoiceCallDockView: React.FC<VoiceCallDockViewProps> = ({
  controller,
  t,
  inputActions,
}) => {
  const [snapshot, setSnapshot] = useState<VoiceSpiritUiState>(() => controller.getSnapshot())
  const prevLiveRef = useRef<boolean>(false)

  useEffect(() => {
    setSnapshot(controller.getSnapshot())
    return controller.subscribe(() => { setSnapshot(controller.getSnapshot()) })
  }, [controller])

  const { engine } = snapshot
  const callLive = engine.phase !== 'idle' || snapshot.launching
  const hasHistory = snapshot.historyTurns.length > 0

  // Automatically bridge completed voice queries into the native conversation on hangup
  useEffect(() => {
    const wasLive = prevLiveRef.current
    prevLiveRef.current = callLive

    // Transition from live call to ended call
    if (wasLive && !callLive && snapshot.lastCall && snapshot.lastCall.turns.length > 0) {
      const userQueries = snapshot.lastCall.turns
        .map(turn => turn.userText.trim())
        .filter(text => text.length > 0)

      if (userQueries.length > 0 && inputActions?.setDraft && inputActions?.submit) {
        const fullPrompt = userQueries.join('\n')
        inputActions.setDraft(fullPrompt)
        window.setTimeout(() => {
          inputActions.submit()
        }, 60)
      }
      controller.dismissLastCall()
    }
  }, [callLive, snapshot.lastCall, inputActions, controller])

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
