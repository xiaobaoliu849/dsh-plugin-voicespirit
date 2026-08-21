/**
 * The plugin's single source of truth: the audio engine, the backend status
 * client, and the harness settings scope, composed into one reactive face the
 * composer button, the call dock, the quick settings popover, and the settings
 * card all read through. Components subscribe to this store and re-render on
 * change; every mutation funnels through here so the four surfaces cannot
 * disagree about provider, credentials, or backend phase.
 */

import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import {
  VoiceAudioEngine,
  type VoiceEngineErrorCode,
  type VoiceEngineState,
  type VoiceTranscriptTurn,
} from './engine/VoiceAudioEngine.ts'
import { VoiceSpiritBackend, type VoiceSpiritBackendState } from './backend.ts'
import {
  providerEntry,
  VOICESPIRIT_SETTINGS_NAMESPACE,
  type BackendSettingsDocument,
  type VoiceSpiritSettings,
} from './contract/settings.ts'
import type { VoiceSpiritKey } from './locales.ts'

/** Everything the UI surfaces read. */
export interface VoiceSpiritUiState {
  /** Engine phase and live transcript state. */
  engine: VoiceEngineState
  /** Microphone level 0..1. */
  micLevel: number
  /** Speaker level 0..1. */
  speakerLevel: number
  /** Log-spaced mic spectrum, SPECTRUM_BANDS slots 0..1 (empty before the first sample). */
  micBands: number[]
  /** Log-spaced speaker spectrum, same shape as `micBands`. */
  spkBands: number[]
  /** Interim user transcript. */
  userText: string
  /** Whether `userText` is interim (still being recognized). */
  isUserInterim: boolean
  /** Assistant text accumulated for the turn in flight. */
  assistantText: string
  /** Completed turns of this browser session (newest last, capped). */
  historyTurns: VoiceTranscriptTurn[]
  /** Backend status snapshot; undefined before the first answer. */
  backend: VoiceSpiritBackendState
  /** Harness settings section; undefined until the scope loads. */
  settings: VoiceSpiritSettings | undefined
  /** Whether the immersive full-screen call view is open. */
  immersiveOpen: boolean
  /** Whether a backend start kicked by a call is still settling. */
  launching: boolean
  /** Transcript of the call that just ended, kept until dismissed or redialed. */
  lastCall: VoiceLastCall | undefined
}

/** The ended call the dock keeps on screen for review and copying. */
export interface VoiceLastCall {
  /** Completed turns, in order (a cut-off tail turn is included as-is). */
  turns: VoiceTranscriptTurn[]
  /** Epoch ms when the call ended. */
  endedAt: number
}

const HISTORY_CAP = 30

export class VoiceSpiritController {
  private readonly engine: VoiceAudioEngine
  private readonly backendClient = new VoiceSpiritBackend()
  private readonly listeners = new Set<() => void>()
  private readonly historyTurns: VoiceTranscriptTurn[] = []

  private micLevel = 0
  private speakerLevel = 0
  private micBands: number[] = []
  private spkBands: number[] = []
  private userText = ''
  private isUserInterim = false
  private assistantText = ''
  private settings: VoiceSpiritSettings | undefined
  private immersiveOpen = false
  private launching = false
  private lastCall: VoiceLastCall | undefined
  private lastErrorCode: VoiceEngineErrorCode | undefined

  constructor(private readonly settingsScope: SettingsScope<VoiceSpiritSettings>) {
    this.engine = new VoiceAudioEngine({
      onStateChange: () => { this.publish() },
      onLevelsChange: (mic, spk, micBands, spkBands) => {
        this.micLevel = mic
        this.speakerLevel = spk
        this.micBands = micBands
        this.spkBands = spkBands
        this.publish()
      },
      onTranscriptChange: (userText, isUserInterim, assistantText) => {
        this.userText = userText
        this.isUserInterim = isUserInterim
        this.assistantText = assistantText
        this.publish()
      },
      onTurnComplete: (turn) => {
        this.historyTurns.push(turn)
        if (this.historyTurns.length > HISTORY_CAP) {
          this.historyTurns.splice(0, this.historyTurns.length - HISTORY_CAP)
        }
        this.userText = ''
        this.isUserInterim = false
        this.assistantText = ''
        this.publish()
      },
      onError: (error) => {
        this.lastErrorCode = error.code
        this.publish()
      },
    })
    this.settingsScope.subscribe(() => {
      this.settings = this.settingsScope.getSnapshot().value
      this.syncEngineConfig()
      this.publish()
    })
    this.settings = this.settingsScope.getSnapshot().value
    this.syncEngineConfig()
    this.backendClient.subscribe(() => { this.publish() })
  }

  /** Publish the current composite snapshot. */
  getSnapshot(): VoiceSpiritUiState {
    return {
      engine: this.engine.getState(),
      micLevel: this.micLevel,
      speakerLevel: this.speakerLevel,
      micBands: this.micBands,
      spkBands: this.spkBands,
      userText: this.userText,
      isUserInterim: this.isUserInterim,
      assistantText: this.assistantText,
      historyTurns: this.historyTurns,
      backend: this.backendClient.getSnapshot(),
      settings: this.settings,
      immersiveOpen: this.immersiveOpen,
      launching: this.launching,
      lastCall: this.lastCall,
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** The engine, for the few imperative call-site needs (text input). */
  getEngine(): VoiceAudioEngine {
    return this.engine
  }

  /** The backend status client, for the settings card's log view. */
  getBackendClient(): VoiceSpiritBackend {
    return this.backendClient
  }

  /** Begin polling backend status (call once on plugin activation). */
  startMonitoring(): void {
    this.backendClient.startPolling()
  }

  stopMonitoring(): void {
    this.backendClient.stopPolling()
  }

  /**
   * Start a call: bring the backend up first when it is ours to start, then
   * open the audio session. The dock shows the launching phase throughout.
   */
  async startCall(): Promise<void> {
    // A fresh call starts a fresh transcript and clears the previous call's
    // review card.
    this.historyTurns.length = 0
    this.lastCall = undefined
    const backend = this.backendClient.getSnapshot().backend
    if ((backend === undefined || !backend.healthy) && this.settings?.autoStart !== false) {
      this.launching = true
      this.publish()
      try {
        await this.backendClient.start()
      } finally {
        this.launching = false
      }
    }
    this.engine.start().catch((error: unknown) => {
      console.error('[ui-voicespirit] start failed:', error)
    })
    this.publish()
  }

  endCall(): void {
    // Snapshot the transcript before teardown: completed turns plus any
    // cut-off tail turn, so the review card shows the whole call.
    const turns = [...this.historyTurns]
    if (this.userText !== '' || this.assistantText !== '') {
      turns.push({
        id: `tail_${Date.now()}`,
        userText: this.userText,
        assistantText: this.assistantText,
        timestamp: Date.now(),
      })
    }
    if (turns.length > 0) {
      this.lastCall = { turns, endedAt: Date.now() }
    }
    this.engine.stop()
    this.userText = ''
    this.isUserInterim = false
    this.assistantText = ''
    this.publish()
  }

  /** Drop the ended-call review card. */
  dismissLastCall(): void {
    this.lastCall = undefined
    this.publish()
  }

  toggleMute(): void {
    this.engine.toggleMute()
  }

  interrupt(): void {
    this.engine.interrupt()
  }

  toggleImmersive(): void {
    this.immersiveOpen = !this.immersiveOpen
    this.publish()
  }

  closeImmersive(): void {
    this.immersiveOpen = false
    this.publish()
  }

  /** Send one text turn through the realtime session. */
  sendText(text: string): boolean {
    return this.engine.sendText(text)
  }

  /** Quick switch from the popover; writes through the settings scope. */
  async setVoiceSelection(patch: { provider?: string, model?: string, voice?: string }): Promise<void> {
    const entry = providerEntry(patch.provider ?? this.engine.getState().provider)
    const ops: Array<Promise<unknown>> = []
    if (patch.provider !== undefined) {
      ops.push(this.settingsScope.set('defaultProvider', patch.provider))
      // A provider switch resets model and voice to the new catalog's first
      // entries unless the caller named them.
      if (patch.model === undefined) ops.push(this.settingsScope.set('defaultModel', entry.models[0] ?? ''))
      if (patch.voice === undefined) ops.push(this.settingsScope.set('defaultVoice', entry.voices[0] ?? ''))
    }
    if (patch.model !== undefined) ops.push(this.settingsScope.set('defaultModel', patch.model))
    if (patch.voice !== undefined) ops.push(this.settingsScope.set('defaultVoice', patch.voice))
    await Promise.all(ops)
    this.syncEngineConfig()
    this.publish()
  }

  /** Apply the settings section to the engine's handshake parameters. */
  private syncEngineConfig(): void {
    const settings = this.settings
    if (settings === undefined) return
    const entry = providerEntry(settings.defaultProvider)
    this.engine.updateOptions({
      provider: settings.defaultProvider || entry.id,
      model: settings.defaultModel || entry.models[0] || '',
      voice: settings.defaultVoice || entry.voices[0] || '',
    })
  }

  /** Locale key for the engine's last error, for UI translation. */
  errorKey(): VoiceSpiritKey | undefined {
    switch (this.lastErrorCode) {
      case 'auth': return 'errAuth'
      case 'unreachable': return 'errUnreachable'
      case 'microphone': return 'errMicrophone'
      case 'server': return 'errServer'
      case 'unknown': return 'errUnknown'
      default: return undefined
    }
  }

  private publish(): void {
    for (const listener of this.listeners) listener()
  }
}

/** Namespace constant re-exported for the settings card's slot registration. */
export { VOICESPIRIT_SETTINGS_NAMESPACE }

/** Re-exports the card and popover share. */
export type { BackendSettingsDocument, VoiceSpiritBackendState, VoiceSpiritSettings }
