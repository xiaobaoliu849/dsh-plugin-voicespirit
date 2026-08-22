/**
 * The native integrated ribbon stacked directly above the composer:
 * a compact 42px status bar with live waveform, streaming transcript,
 * and quick controls. Expands to the immersive full-screen view upon request.
 *
 * When a voice call is active, data-voicespirit-active snaps the input bar
 * down to the bottom of the window.
 * When a voice call ends, the transcript automatically bridges into the native
 * chat session, transitioning the interface into the standard bottom-docked
 * conversation state.
 */

import React, { useEffect, useState, useRef } from 'react'
import type { VoiceSpiritController, VoiceSpiritUiState } from '../voice-controller.ts'
import type { VoiceSpiritKey } from '../locales.ts'
import { VoiceCallDockBar } from './VoiceCallDockBar.tsx'
import { VoiceCallImmersiveModal } from './VoiceCallImmersiveModal.tsx'

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

  // Automatically bridge completed voice queries into the native conversation
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
      data-voicespirit-active={callLive ? 'true' : undefined}
      style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}
    >
      {callLive && (
        <VoiceCallDockBar snapshot={snapshot} controller={controller} t={t} />
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
