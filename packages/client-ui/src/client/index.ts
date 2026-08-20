/**
 * VoiceSpirit Realtime Voice Plugin Client Assembly
 * Deeply integrates realtime duplex voice conversations with DeepSeek Harness design language.
 */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { VoiceAudioEngine, type VoiceEngineState, type VoiceTranscriptTurn } from './engine/VoiceAudioEngine.ts'
import { VoiceCallHeaderButton } from './components/VoiceCallButton.tsx'
import { VoiceCallDockView } from './components/VoiceCallDockView.tsx'
import { en, zh, type VoiceSpiritKey } from './locales.ts'
import type { VoiceSpiritInjectedActions } from './slots.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    voicespirit: VoiceSpiritKey
  }
}

const NS = 'voicespirit'

export const inject = ['slots', 'sessions', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-voicespirit: dictionaries')

  // Global Engine Instance
  let engineInstance: VoiceAudioEngine | null = null
  const subscribers = new Set<() => void>()

  let currentState: VoiceEngineState = {
    phase: 'idle',
    isConnected: false,
    isMuted: false,
    provider: 'Cartesia',
    model: 'cartesia-realtime',
    voice: 'f786b574-daa5-4673-aa0c-cbe3e8534c02',
  }

  let micLevel = 0
  let speakerLevel = 0
  let currentUserText = ''
  let isUserInterim = false
  let currentAssistantText = ''
  const historyTurns: VoiceTranscriptTurn[] = []

  function notify() {
    subscribers.forEach((cb) => cb())
  }

  function getOrCreateEngine(sessionId?: SessionId): VoiceAudioEngine {
    if (!engineInstance) {
      engineInstance = new VoiceAudioEngine({
        onStateChange: (state) => {
          currentState = state
          notify()
        },
        onLevelsChange: (mic, spk) => {
          micLevel = mic
          speakerLevel = spk
          notify()
        },
        onTranscriptChange: (userText, interim, assistantText) => {
          currentUserText = userText
          isUserInterim = interim
          currentAssistantText = assistantText
          notify()
        },
        onTurnComplete: (turn) => {
          historyTurns.push(turn)
          currentUserText = ''
          isUserInterim = false
          currentAssistantText = ''
          notify()

          if (sessionId) {
            try {
              const binding = ctx.sessions?.binding(sessionId)
              if (binding) {
                console.log('[ui-voicespirit] Synchronized turn to session:', sessionId, turn)
              }
            } catch (e) {
              console.warn('[ui-voicespirit] Session sync error:', e)
            }
          }
        },
        onError: (err) => {
          console.error('[ui-voicespirit] Voice Engine Error:', err)
          notify()
        },
      })
      currentState = engineInstance.getState()
    }
    return engineInstance
  }

  const getActions = (): VoiceSpiritInjectedActions => {
    const engine = getOrCreateEngine()
    return {
      startCall: () => {
        engine.start()
        notify()
      },
      endCall: () => {
        engine.stop()
        notify()
      },
      toggleMute: () => engine.toggleMute(),
      interrupt: () => engine.interrupt(),
      openSettings: () => {},
      toggleImmersive: () => {
        notify()
      },
      isCallActive: currentState.isConnected || currentState.phase !== 'idle',
      isMuted: currentState.isMuted,
    }
  }

  const subscribe = (cb: () => void) => {
    subscribers.add(cb)
    return () => {
      subscribers.delete(cb)
    }
  }

  const t = (k: VoiceSpiritKey) => zh[k] || (k as string)

  // 1. Inject into conversation composer toolbar (bottom-right next to model selector)
  ctx.slots.inject(
    'conversation.input.right',
    () =>
      ctx.slots.register(
        {
          name: 'conversation.input.right',
          id: 'ui-voicespirit:mic-btn',
          order: 90,
          inject: () => {
            getOrCreateEngine()
            return {
              actions: getActions(),
              state: currentState,
            }
          },
        },
        VoiceCallHeaderButton,
      ),
  )

  // 2. Inject VoiceSpirit integrated stage (Audio Orb + Ribbon + Controls + Hangup) directly above the composer
  ctx.slots.inject(
    'conversation.input.dock',
    () =>
      ctx.slots.register(
        {
          name: 'conversation.input.dock',
          id: 'ui-voicespirit:dock',
          order: 10,
          inject: (props: any) => ({
            sessionId: props?.sessionId,
            t,
            getEngine: () => getOrCreateEngine(props?.sessionId),
            getState: () => currentState,
            getMicLevel: () => micLevel,
            getSpeakerLevel: () => speakerLevel,
            getCurrentUserText: () => currentUserText,
            getIsUserInterim: () => isUserInterim,
            getCurrentAssistantText: () => currentAssistantText,
            getHistoryTurns: () => historyTurns,
            subscribe,
          }),
        },
        VoiceCallDockView,
      ),
  )
}
