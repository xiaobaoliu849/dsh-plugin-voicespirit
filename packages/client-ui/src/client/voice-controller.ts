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
  buildMemorySessionConfig,
  providerEntry,
  readBackendPath,
  readMemorySettingsView,
  VOICESPIRIT_SETTINGS_NAMESPACE,
  type BackendSettingsDocument,
  type MemorySettingsView,
  type VoiceSpiritSettings,
} from './contract/settings.ts'
import type { VoiceMemoryState } from './engine/VoiceAudioEngine.ts'
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
  /** Live translated text streamed in flight. */
  translationText: string
  /** Active voice interaction mode: dialogue (conversation) or translate (simultaneous interpreter). */
  activeVoiceMode: 'dialogue' | 'translate'
  /** LiveTranslate source language (e.g. zh-Hans). */
  sourceLanguage: string
  /** LiveTranslate target language (e.g. en). */
  targetLanguage: string
  /** Whether to speak translated speech aloud via TTS. */
  echoTargetLanguage: boolean
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
  /** EverMemOS state reported by the backend for the session; undefined when off. */
  memory: VoiceMemoryState | undefined
  /** Missing credentials keys if preflight validation fails. */
  missingCredentials?: string[] | undefined
  /** Nonce incremented when a UI element requests the settings popover to open. */
  openSettingsTrigger?: number | undefined
}

/** The ended call the dock keeps on screen for review and copying. */
export interface VoiceLastCall {
  /** Completed turns, in order (a cut-off tail turn is included as-is). */
  turns: VoiceTranscriptTurn[]
  /** Epoch ms when the call ended. */
  endedAt: number
}

/** Realtime audio levels and spectrum bands. */
export interface VoiceAudioLevels {
  micLevel: number
  speakerLevel: number
  micBands: number[]
  spkBands: number[]
}

const HISTORY_CAP = 30
/** Session-scoped EverMemOS conversation group; a fresh tab starts a new thread. */
const EVERMEM_GROUP_STORAGE_KEY = 'voicespirit_evermem_voice_group'

export class VoiceSpiritController {
  private readonly engine: VoiceAudioEngine
  private readonly backendClient = new VoiceSpiritBackend()
  private readonly listeners = new Set<() => void>()
  private readonly levelListeners = new Set<(levels: VoiceAudioLevels) => void>()
  private readonly historyTurns: VoiceTranscriptTurn[] = []
  private memorySettings: MemorySettingsView | undefined

  private micLevel = 0
  private speakerLevel = 0
  private micBands: number[] = []
  private spkBands: number[] = []
  private userText = ''
  private isUserInterim = false
  private assistantText = ''
  private translationText = ''
  private settings: VoiceSpiritSettings | undefined
  private immersiveOpen = false
  private launching = false
  private lastCall: VoiceLastCall | undefined
  private lastErrorCode: VoiceEngineErrorCode | undefined
  private missingCredentials: string[] = []
  private openSettingsTrigger = 0

  constructor(private readonly settingsScope: SettingsScope<VoiceSpiritSettings>) {
    this.engine = new VoiceAudioEngine({
      onStateChange: () => { this.publish() },
      onLevelsChange: (mic, spk, micBands, spkBands) => {
        this.micLevel = mic
        this.speakerLevel = spk
        this.micBands = micBands
        this.spkBands = spkBands
        if (this.levelListeners.size > 0) {
          const levels: VoiceAudioLevels = {
            micLevel: mic,
            speakerLevel: spk,
            micBands,
            spkBands,
          }
          this.levelListeners.forEach((fn) => { fn(levels) })
        }
      },
      onTranscriptChange: (userText, isUserInterim, assistantText, translationText) => {
        this.userText = userText
        this.isUserInterim = isUserInterim
        this.assistantText = assistantText
        this.translationText = translationText || ''
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
        this.translationText = ''
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
    const isTranslate = this.settings?.activeVoiceMode === 'translate' || (this.settings?.defaultModel ? this.settings.defaultModel.includes('translate') : false)
    return {
      engine: this.engine.getState(),
      micLevel: this.micLevel,
      speakerLevel: this.speakerLevel,
      micBands: this.micBands,
      spkBands: this.spkBands,
      userText: this.userText,
      isUserInterim: this.isUserInterim,
      assistantText: this.assistantText,
      translationText: this.translationText,
      activeVoiceMode: isTranslate ? 'translate' : 'dialogue',
      sourceLanguage: this.settings?.sourceLanguage || 'zh-Hans',
      targetLanguage: this.settings?.targetLanguage || 'en',
      echoTargetLanguage: this.settings?.echoTargetLanguage !== false,
      historyTurns: this.historyTurns,
      backend: this.backendClient.getSnapshot(),
      settings: this.settings,
      immersiveOpen: this.immersiveOpen,
      launching: this.launching,
      lastCall: this.lastCall,
      memory: this.engine.getState().memory,
      missingCredentials: this.missingCredentials.length > 0 ? this.missingCredentials : undefined,
      openSettingsTrigger: this.openSettingsTrigger,
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Request the UI to open the settings popover (e.g. from error action buttons). */
  requestOpenSettings(): void {
    this.openSettingsTrigger = Date.now()
    this.publish()
  }

  /** Subscribe to high-frequency 60Hz audio levels without triggering full React re-renders. */
  subscribeLevels(listener: (levels: VoiceAudioLevels) => void): () => void {
    this.levelListeners.add(listener)
    return () => { this.levelListeners.delete(listener) }
  }

  /** Read the latest instantaneous audio volume and spectrum bands. */
  getAudioLevels(): VoiceAudioLevels {
    return {
      micLevel: this.micLevel,
      speakerLevel: this.speakerLevel,
      micBands: this.micBands,
      spkBands: this.spkBands,
    }
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
    this.missingCredentials = []

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
    // Pre-validate that credentials exist for the selected provider
    const document = await this.backendClient.fetchSettings()
    if (document !== undefined) {
      const provider = this.settings?.defaultProvider ?? 'DashScope'
      const entry = providerEntry(provider)
      const missingSecrets = entry.credentials
        .filter(c => c.secret)
        .filter(c => readBackendPath(document, c.path).trim() === '')
      const missingKeys: string[] = missingSecrets.map(c => c.labelKey)
      if (provider === 'DashScope') {
        const rtUrl = readBackendPath(document, 'realtime_api_urls.DashScope').trim()
        if (rtUrl === '') {
          missingKeys.push('credDashscopeRealtimeUrl')
        }
      }

      if (missingKeys.length > 0) {
        this.missingCredentials = missingKeys
        this.lastErrorCode = 'auth'
        const msg = provider === 'DashScope' && missingKeys.includes('credDashscopeRealtimeUrl')
          ? '缺少 DashScope API Key 或 Realtime WebSocket 地址 (格式: wss://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api-ws/v1/realtime)，请先配置密钥。'
          : `缺少 ${provider} 必需的 API Key，请点击「配置密钥」进行配置。`
        this.engine.reportPreflightError('auth', msg)
        this.publish()
        return
      }
    }
    // Memory rides the session handshake: resolve it from the backend's stored
    // settings right before connecting so edits apply from the very next call.
    await this.applyMemoryConfig()
    this.engine.start().catch((error: unknown) => {
      console.error('[ui-voicespirit] start failed:', error)
    })
    this.publish()
  }

  /**
   * Resolve the EverMemOS payload for this call: read the backend's stored
   * memory settings, reuse (or register) the browser session's conversation
   * group, and hand the assembled config to the engine.
   */
  private async applyMemoryConfig(): Promise<void> {
    const document = await this.backendClient.fetchSettings()
    if (document === undefined) return
    const view = readMemorySettingsView(document)
    this.memorySettings = view
    const groupId = this.recallEvermemGroup(view)
    const memory = buildMemorySessionConfig(view, groupId)
    this.engine.updateOptions({ memory })
  }

  /** Reuse this tab's EverMemOS conversation group when memory is usable for voice. */
  private recallEvermemGroup(view: MemorySettingsView): string | undefined {
    if (!view.enabled || view.temporarySession || !view.rememberVoiceChat || view.apiKey.trim() === '') {
      return undefined
    }
    try {
      return window.sessionStorage.getItem(EVERMEM_GROUP_STORAGE_KEY) ?? undefined
    } catch {
      return undefined
    }
  }

  /** Register a fresh EverMemOS conversation group; exposed for the settings card. */
  async registerEvermemGroup(): Promise<string | undefined> {
    const group = await this.backendClient.fetchConversationMeta(
      window.sessionStorage.getItem(EVERMEM_GROUP_STORAGE_KEY) ?? undefined,
    )
    if (group !== undefined) {
      try { window.sessionStorage.setItem(EVERMEM_GROUP_STORAGE_KEY, group) } catch { /* storage unavailable */ }
    }
    return group
  }

  /** Stored memory settings as last resolved from the backend document. */
  getMemorySettings(): MemorySettingsView | undefined {
    return this.memorySettings
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

  startPushToTalk(): void {
    this.engine.startPushToTalk()
  }

  stopPushToTalk(): void {
    this.engine.stopPushToTalk()
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

  /** Switch between Dialogue mode and LiveTranslate simultaneous interpreter mode. */
  async setVoiceMode(mode: 'dialogue' | 'translate'): Promise<void> {
    const currentProvider = this.settings?.defaultProvider || 'DashScope'
    let targetModel = this.settings?.defaultModel || ''

    if (mode === 'translate') {
      if (currentProvider === 'DashScope') {
        targetModel = 'qwen3.5-livetranslate-flash-realtime'
      } else if (currentProvider === 'Google') {
        targetModel = 'gemini-3.5-live-translate-preview'
      }
    } else {
      if (currentProvider === 'DashScope' && targetModel.includes('livetranslate')) {
        targetModel = 'qwen3.5-omni-plus-realtime'
      } else if (currentProvider === 'Google' && targetModel.includes('translate')) {
        targetModel = 'gemini-3.1-flash-live-preview'
      }
    }

    await Promise.all([
      this.settingsScope.set('activeVoiceMode', mode),
      this.settingsScope.set('defaultModel', targetModel),
    ])
    this.syncEngineConfig()
    this.publish()
  }

  /** Set source and target languages for LiveTranslate. */
  async setLanguagePair(source: string, target: string): Promise<void> {
    await Promise.all([
      this.settingsScope.set('sourceLanguage', source),
      this.settingsScope.set('targetLanguage', target),
    ])
    this.syncEngineConfig()
    this.publish()
  }

  /** Swap source and target languages instantly. */
  async swapLanguages(): Promise<void> {
    const src = this.settings?.sourceLanguage || 'zh-Hans'
    const tgt = this.settings?.targetLanguage || 'en'
    await this.setLanguagePair(tgt, src)
  }

  /** Toggle whether the AI speaks translated text aloud. */
  async toggleEchoTargetLanguage(): Promise<void> {
    const current = this.settings?.echoTargetLanguage !== false
    await this.settingsScope.set('echoTargetLanguage', !current)
    this.syncEngineConfig()
    this.publish()
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
      translationMode: settings.translationMode || 'bidirectional',
      sourceLanguage: settings.sourceLanguage || 'zh-Hans',
      targetLanguage: settings.targetLanguage || 'en',
      echoTargetLanguage: settings.echoTargetLanguage !== false,
    })
  }

  /** Locale key for the engine's last error, for UI translation. */
  errorKey(): VoiceSpiritKey | undefined {
    switch (this.lastErrorCode) {
      case 'auth': return 'errAuth'
      case 'unreachable': return 'errUnreachable'
      case 'microphone': return 'errMicrophone'
      case 'mic_denied': return 'errMicDenied'
      case 'mic_not_found': return 'errMicNotFound'
      case 'mic_in_use': return 'errMicInUse'
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
