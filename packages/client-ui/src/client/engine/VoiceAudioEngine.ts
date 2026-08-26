/**
 * Full-duplex WebAudio and WebSocket Engine for VoiceSpirit
 * Handles microphone downsampling to 16kHz PCM mono, streaming over WebSocket,
 * receiving and decoding low-latency audio chunks, dynamic volume monitoring,
 * and generational barge-in / interruption clearing.
 *
 * The WebSocket target defaults to the harness-host proxy route
 * (`/api/voicespirit/ws`): the host folds backend authentication in, so the
 * browser holds no credential. A direct `gatewayUrl` override keeps working
 * for users pointing at a remote gateway that authenticates by query token.
 */

import type { EvermemSessionConfig } from '../contract/settings.ts'

export type VoiceEnginePhase = 'idle' | 'connecting' | 'reconnecting' | 'listening' | 'speaking' | 'interrupted' | 'error'

/** Stable error classes the UI translates; the raw message rides alongside. */
export type VoiceEngineErrorCode =
  | 'auth'
  | 'unreachable'
  | 'microphone'
  | 'mic_denied'
  | 'mic_not_found'
  | 'mic_in_use'
  | 'net_timeout'
  | 'server'
  | 'unknown'

/** Live EverMemOS state as the backend reports it over the session. */
export interface VoiceMemoryState {
  /** Backend confirmed the memory session is active (config accepted with a key). */
  active: boolean
  /** Cloud namespace the backend resolved for this session. */
  scope: string
  /** Conversation group the memories attach to, when one was registered. */
  group: string
  /** Memories injected into the last turn's instructions. */
  retrieved: number
  /** Entries persisted after the last completed turn. */
  saved: number
  /** Why the last turn wrote nothing (empty = success or nothing yet). */
  writeReason: string
}

export interface VoiceEngineState {
  phase: VoiceEnginePhase
  isConnected: boolean
  isMuted: boolean
  isPushToTalk?: boolean
  reconnectAttempt?: number
  provider: string
  model: string
  voice: string
  /** Memory state once the backend answers the config message; undefined before. */
  memory?: VoiceMemoryState | undefined
  errorMessage?: string | undefined
  errorCode?: VoiceEngineErrorCode | undefined
}

export interface VoiceCallOptions {
  gatewayUrl?: string | undefined
  provider?: string | undefined
  model?: string | undefined
  voice?: string | undefined
  /** LiveTranslate options */
  translationMode?: 'bidirectional' | 'unidirectional' | undefined
  sourceLanguage?: string | undefined
  targetLanguage?: string | undefined
  echoTargetLanguage?: boolean | undefined
  /** Whether client-side energy VAD gating is enabled (default: true) */
  vadEnabled?: boolean | undefined
  /** EverMemOS payload sent in the session `config` message; undefined = memory off. */
  memory?: EvermemSessionConfig | undefined
  onStateChange?: ((state: VoiceEngineState) => void) | undefined
  onLevelsChange?: ((micLevel: number, speakerLevel: number, micBands: number[], speakerBands: number[]) => void) | undefined
  onTranscriptChange?: ((userText: string, isInterim: boolean, assistantText: string, translationText?: string) => void) | undefined
  onTurnComplete?: ((turn: VoiceTranscriptTurn) => void) | undefined
  onError?: ((error: { code: VoiceEngineErrorCode, message: string }) => void) | undefined
}

export interface VoiceTranscriptTurn {
  id: string
  userText: string
  assistantText: string
  translationText?: string
  sourceLanguage?: string
  targetLanguage?: string
  timestamp: number
  interrupted?: boolean
}

/** JSON control events the backend streams alongside binary audio frames. */
interface VoiceServerEvent {
  type?: string
  text?: string
  translation?: string
  source_text?: string
  target_text?: string
  source_language?: string
  target_language?: string
  interim?: boolean
  audio?: string
  data?: string
  sample_rate?: number
  turn_id?: string
  interrupted?: boolean
  message?: string
  /** Backend marks cumulative snapshots / final canonical text; absence = verbatim delta. */
  cumulative?: boolean
  // memory_config / memory_context / memory_write payloads
  enabled?: boolean
  scope?: string
  group_id?: string
  memories_retrieved?: number
  saved_count?: number
  reason?: string
  attempted?: boolean
}

/** Spectrum slots the level monitor reports; the dock waveform renders one bar each. */
export const SPECTRUM_BANDS = 8

/** The harness proxy route when the UI is served by the harness web server. */
export function deriveProxyGatewayUrl(): string {
  if (typeof window === 'undefined' || window.location === undefined) {
    return 'ws://127.0.0.1:3080/api/voicespirit/ws'
  }
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${window.location.host}/api/voicespirit/ws`
}

function normalizeGatewayUrl(url?: string): string {
  let base = (url || '').trim() || deriveProxyGatewayUrl()
  if (base.startsWith('http://')) {
    base = base.replace('http://', 'ws://')
  } else if (base.startsWith('https://')) {
    base = base.replace('https://', 'wss://')
  }
  if (base.endsWith('/voice-chat/ws') && !base.includes('/api/voice-chat/ws')) {
    base = base.replace('/voice-chat/ws', '/api/voice-chat/ws')
  }
  return base
}

/** Average one log-spaced band of an FFT frame into a 0..1 level. */
function extractBands(data: Uint8Array, edges: number[]): number[] {
  const bands: number[] = []
  for (let b = 0; b < edges.length - 1; b++) {
    const start = edges[b] ?? 0
    const end = Math.min(edges[b + 1] ?? data.length, data.length)
    let sum = 0
    let count = 0
    for (let i = start; i < end; i++) {
      sum += data[i] ?? 0
      count++
    }
    bands.push(count > 0 ? sum / count / 255 : 0)
  }
  return bands
}

export function containsLatinText(value: string): boolean {
  return /[A-Za-z]/.test(value)
}

export function isCJKPredominant(value: string): boolean {
  if (!value) return false
  let cjk = 0
  for (const c of value) {
    const cp = c.codePointAt(0) ?? 0
    if (
      (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
      (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Extension A
      (cp >= 0xf900 && cp <= 0xfaff) || // CJK Compatibility Ideographs
      (cp >= 0x3040 && cp <= 0x309f) || // Hiragana
      (cp >= 0x30a0 && cp <= 0x30ff) || // Katakana
      (cp >= 0xac00 && cp <= 0xd7af) || // Hangul Syllables
      (cp >= 0x1100 && cp <= 0x11ff)    // Hangul Jamo
    ) {
      cjk += 1
    }
  }
  return cjk > value.length * 0.3
}

export function appendStreamingText(previous: string, incoming: string): string {
  const before = previous.trim()
  const next = incoming.trim()
  if (!before) return next
  if (!next) return before

  // Only insert a word-boundary space when the surrounding text is primarily Latin-script
  if (
    (containsLatinText(before) || containsLatinText(next)) &&
    !isCJKPredominant(before) &&
    !isCJKPredominant(next)
  ) {
    return `${before} ${next}`.replace(/\s+([,.!?;:])/g, '$1')
  }
  return `${before}${next}`
}

/**
 * Append one streaming text delta to the accumulated assistant reply.
 *
 * Realtime providers stream sub-word (BPE) token deltas whose whitespace is
 * authoritative: a new word arrives carrying its own leading space (" world"),
 * while a continuation of the current word arrives without one ("ful"). The
 * backend treats a delta stream as a verbatim concatenation (see
 * `ai_acc + content` in realtime_doubao_provider.py), so the on-screen text
 * must be built the same way to stay in sync with the spoken audio.
 *
 * Never trim a delta and never invent a separator. Trimming destroys the
 * provider's own word-boundary signal, and re-inserting a space by script
 * heuristic splits words that were streamed as several tokens
 * ("wonder" + "ful" -> "wonder ful"). For the same reason there is no
 * duplicate/overlap suppression here: an ordered WebSocket never re-delivers a
 * delta, whereas natural language genuinely repeats fragments ("ha" + "ha").
 *
 * Cumulative snapshots (a provider re-sending the whole transcript so far, or
 * a final canonical correction) are NOT deltas — route those through
 * {@link mergeAssistantText} instead. The backend marks them with
 * `cumulative: true` on the wire.
 */
export function appendAssistantDelta(previous: string, delta: string): string {
  if (!delta) return previous
  if (!previous) {
    // Only the very first fragment of a turn may carry a stray leading space.
    return delta.replace(/^\s+/, '')
  }
  return `${previous}${delta}`
}

export function mergeAssistantText(previous: string, incoming: string): string {
  const next = incoming.trim()
  if (!next) return previous
  if (!previous) return next
  const prevTrimmed = previous.trim()

  // If incoming is an exact cumulative replacement (starts with previous), adopt it
  if (next.startsWith(prevTrimmed)) {
    return next
  }

  // Exact duplicate of the last chunk
  if (prevTrimmed === next) {
    return previous
  }

  // True tail duplicate: previous already ends with the exact incoming text
  if (prevTrimmed.endsWith(next)) {
    return previous
  }

  // Find longest suffix-prefix overlap to merge without gaps or duplication
  let maxOverlap = 0
  const maxSearchLen = Math.min(prevTrimmed.length, next.length)
  for (let len = maxSearchLen; len >= 1; len--) {
    if (prevTrimmed.endsWith(next.slice(0, len))) {
      maxOverlap = len
      break
    }
  }

  if (maxOverlap > 0) {
    const novel = next.slice(maxOverlap)
    return appendStreamingText(previous, novel)
  }

  return appendStreamingText(previous, next)
}

/**
 * AudioWorkletProcessor script executed on the audio rendering thread.
 * Downsamples input stream to 16kHz Int16 PCM, computes RMS energy, tracks
 * dynamic noise floor, and applies adaptive VAD gating with hangover holdoff.
 */
const AUDIO_WORKLET_PROCESSOR_CODE = `
class VoiceAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.inputSampleRate = 48000
    this.targetSampleRate = 16000
    this.isMuted = false
    this.vadEnabled = true
    this.buffer = []
    this.noiseFloor = 0.005
    this.minThreshold = 0.012
    this.hangoverFrames = 0
    this.hangoverMaxFrames = 12 // ~380ms at 512 samples per frame (32ms per frame)
    this.silenceHeartbeatCounter = 0
    this.silenceHeartbeatInterval = 45 // ~1.5s comfort heartbeat

    this.port.onmessage = (event) => {
      const data = event.data
      if (!data) return
      if (data.type === 'set_muted') {
        this.isMuted = Boolean(data.muted)
      } else if (data.type === 'set_vad') {
        this.vadEnabled = data.enabled !== false
        if (typeof data.minThreshold === 'number') {
          this.minThreshold = data.minThreshold
        }
      } else if (data.type === 'init') {
        this.inputSampleRate = data.inputSampleRate || 48000
        this.targetSampleRate = data.targetSampleRate || 16000
      }
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (!input || !input[0] || input[0].length === 0) return true
    if (this.isMuted) return true

    const channelData = input[0]
    for (let i = 0; i < channelData.length; i++) {
      this.buffer.push(channelData[i])
    }

    const ratio = this.inputSampleRate / this.targetSampleRate
    const targetChunkSize = 512
    const requiredInputSamples = Math.round(targetChunkSize * ratio)

    while (this.buffer.length >= requiredInputSamples) {
      const chunk = this.buffer.splice(0, requiredInputSamples)
      const pcm16 = this.downsampleAndQuantize(chunk, this.inputSampleRate, this.targetSampleRate)
      if (pcm16.length > 0) {
        this.handleChunk(pcm16)
      }
    }

    return true
  }

  downsampleAndQuantize(buffer, fromRate, toRate) {
    const ratio = fromRate / toRate
    const newLength = Math.round(buffer.length / ratio)
    const result = new Int16Array(newLength)
    let offsetResult = 0
    let offsetBuffer = 0

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio)
      let accum = 0
      let count = 0
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i] || 0
        count++
      }
      const val = count > 0 ? accum / count : 0
      const s = Math.max(-1, Math.min(1, val))
      result[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7fff
      offsetResult++
      offsetBuffer = nextOffsetBuffer
    }
    return result
  }

  handleChunk(pcm16) {
    let sumSquares = 0
    for (let i = 0; i < pcm16.length; i++) {
      const norm = pcm16[i] / 32768
      sumSquares += norm * norm
    }
    const rms = Math.sqrt(sumSquares / pcm16.length)

    this.noiseFloor = this.noiseFloor * 0.98 + rms * 0.02
    const dynamicThreshold = Math.max(this.minThreshold, this.noiseFloor * 2.2)

    const isVoice = rms > dynamicThreshold
    if (isVoice) {
      this.hangoverFrames = this.hangoverMaxFrames
    } else if (this.hangoverFrames > 0) {
      this.hangoverFrames--
    }

    const shouldSend = !this.vadEnabled || isVoice || this.hangoverFrames > 0

    if (shouldSend) {
      this.silenceHeartbeatCounter = 0
      this.port.postMessage({
        type: 'pcm',
        pcm: pcm16.buffer,
        rms: rms,
        isVoice: isVoice
      }, [pcm16.buffer])
    } else {
      this.silenceHeartbeatCounter++
      if (this.silenceHeartbeatCounter >= this.silenceHeartbeatInterval) {
        this.silenceHeartbeatCounter = 0
        this.port.postMessage({
          type: 'pcm',
          pcm: pcm16.buffer,
          rms: rms,
          isVoice: false
        }, [pcm16.buffer])
      }
    }
  }
}
registerProcessor('voicespirit-audio-processor', VoiceAudioProcessor)
`

export class VoiceAudioEngine {
  private options: VoiceCallOptions
  private audioCtx: AudioContext | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private micGain: GainNode | null = null
  private micAnalyser: AnalyserNode | null = null
  private micWorkletNode: AudioWorkletNode | null = null
  private micProcessor: ScriptProcessorNode | null = null
  private micSink: GainNode | null = null
  private mediaStream: MediaStream | null = null
  private speakerGain: GainNode | null = null
  private speakerAnalyser: AnalyserNode | null = null
  private workletBlobUrl: string | null = null
  private deviceChangeListener: (() => void) | null = null

  private ws: WebSocket | null = null
  private isMuted: boolean = false
  private isPushToTalk: boolean = false
  private wasMutedBeforePushToTalk: boolean = false
  private isConnected: boolean = false
  private phase: VoiceEnginePhase = 'idle'
  private errorMessage: string = ''
  private errorCode: VoiceEngineErrorCode = 'unknown'
  private memory: VoiceMemoryState | undefined

  // VAD state for ScriptProcessor fallback
  private fallbackNoiseFloor = 0.005
  private fallbackHangoverFrames = 0
  private fallbackSilenceHeartbeatCounter = 0

  private reconnectAttempt: number = 0
  private readonly maxReconnectAttempts: number = 3
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isManuallyStopped: boolean = false
  private pingIntervalId: number | null = null
  private visibilityListener: (() => void) | null = null

  private currentUserText: string = ''
  private currentAssistantText: string = ''
  private currentTranslationText: string = ''
  private isUserInterim: boolean = false
  private currentTurnId: string = ''
  private currentTurnInterrupted: boolean = false

  // Last `error` event text from the backend; takes precedence over the
  // generic close-code diagnosis so config problems surface verbatim.
  private serverErrorMessage: string | undefined

  // Liveness tracking: if the backend accepts the WebSocket but never sends
  // any message (silent failure due to missing config), time out and report.
  private receivedAnyMessage: boolean = false
  private aliveTimer: ReturnType<typeof setTimeout> | null = null

  // Playback scheduler & interruption generation counter
  private playbackGeneration: number = 0
  private nextPlaybackTime: number = 0
  private activeSources: AudioBufferSourceNode[] = []

  private levelIntervalId: number | null = null

  constructor(options: VoiceCallOptions = {}) {
    this.options = { ...options }
  }

  public updateOptions(newOptions: Partial<VoiceCallOptions>): void {
    this.options = { ...this.options, ...newOptions }
    if (this.micWorkletNode && newOptions.vadEnabled !== undefined) {
      this.micWorkletNode.port.postMessage({
        type: 'set_vad',
        enabled: newOptions.vadEnabled,
      })
    }
    this.notifyState()
  }

  public getGatewayUrl(): string {
    return normalizeGatewayUrl(this.options.gatewayUrl)
  }

  public getState(): VoiceEngineState {
    return {
      phase: this.phase,
      isConnected: this.isConnected,
      isMuted: this.isMuted,
      isPushToTalk: this.isPushToTalk,
      reconnectAttempt: this.phase === 'reconnecting' ? this.reconnectAttempt : undefined,
      provider: this.options.provider || '',
      model: this.options.model || '',
      voice: this.options.voice || '',
      memory: this.memory,
      errorMessage: this.errorMessage === '' ? undefined : this.errorMessage,
      errorCode: this.phase === 'error' ? this.errorCode : undefined,
    }
  }

  public async start(): Promise<void> {
    if (this.isConnected || this.phase === 'connecting') return

    this.isManuallyStopped = false
    this.reconnectAttempt = 0
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.setPhase('connecting')
    this.errorMessage = ''
    this.errorCode = 'unknown'
    this.serverErrorMessage = undefined
    this.receivedAnyMessage = false
    if (this.aliveTimer !== null) { clearTimeout(this.aliveTimer); this.aliveTimer = null }
    this.memory = this.options.memory === undefined ? undefined : {
      active: false,
      scope: '',
      group: '',
      retrieved: 0,
      saved: 0,
      writeReason: '',
    }

    try {
      // 1. Initialize WebAudio & Microphone
      await this.initAudioInput()

      // 2. Build WebSocket URL and Connect
      const wsUrl = this.buildWsUrl()
      this.ws = new WebSocket(wsUrl)
      this.ws.binaryType = 'arraybuffer'

      this.ws.onopen = () => {
        this.isConnected = true
        this.reconnectAttempt = 0
        // Memory config rides the first client message: the backend applies it
        // to every subsequent turn (retrieval injection + turn-final writes).
        if (this.options.memory !== undefined && this.ws !== null && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'config', memory: this.options.memory }))
        }
        this.startPingKeepalive()
        this.setPhase('listening')
        // Start a liveness timer: if the backend accepts the socket but
        // never sends any message within 15 s, the session is silently
        // broken (typically a misconfigured provider or missing key that
        // the provider SDK swallows).
        this.aliveTimer = setTimeout(() => {
          if (!this.receivedAnyMessage && this.isConnected) {
            this.fail('server', '语音服务已连接但无响应 — 请检查当前 Provider 的 API Key 和 Realtime URL 配置')
            this.stop(false, true)
          }
        }, 15_000)
      }

      this.ws.onmessage = (event) => {
        this.handleWsMessage(event.data)
      }

      this.ws.onerror = () => {
        // ws.onclose takes care of reconnect/failure classification
      }

      this.ws.onclose = (ev) => {
        this.stopPingKeepalive()
        const wasLive = this.isConnected
          || this.phase === 'listening'
          || this.phase === 'speaking'
          || this.phase === 'connecting'
        // The backend reports its own failure (bad key, missing realtime URL)
        // with an `error` event right before closing — show that, not a
        // generic close-code guess.
        if (this.serverErrorMessage !== undefined) {
          this.fail('server', this.serverErrorMessage)
          this.stop(false, true)
          return
        }
        if (ev.code === 1008) {
          this.fail('auth', `close ${ev.code}`)
          this.stop(false, true)
          return
        }
        if (ev.code === 1013) {
          // The proxy closes with 1013 while the backend is down or starting.
          this.fail('unreachable', ev.reason || 'backend unavailable')
          this.stop(false, true)
          return
        }
        // Auto-reconnect on unexpected disconnects if the session was active
        if (!this.isManuallyStopped && wasLive && this.reconnectAttempt < this.maxReconnectAttempts) {
          this.scheduleReconnect()
          return
        }
        if (wasLive) {
          this.fail('unreachable', `close ${ev.code}`)
          this.stop(false, true)
          return
        }
        if (this.phase !== 'idle') {
          this.stop(false)
        }
      }

      this.startLevelMonitor()
    } catch (err) {
      console.error('[VoiceAudioEngine] Failed to start audio input:', err)
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          this.fail('mic_denied', '麦克风权限被拒绝，请在浏览器地址栏左侧允许麦克风权限')
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          this.fail('mic_not_found', '未检测到可用麦克风硬件，请连接麦克风后重试')
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          this.fail('mic_in_use', '麦克风被其他应用程序占用或硬件冲突，请关闭其他录音软件后重试')
        } else {
          this.fail('microphone', err.message || '麦克风初始化失败')
        }
      } else {
        const message = err instanceof Error ? err.message : 'microphone unavailable'
        this.fail('microphone', message)
      }
      this.stop(false, true)
    }
  }

  /** Schedule exponential backoff reconnect on unexpected network drops. */
  private scheduleReconnect(): void {
    if (this.isManuallyStopped) return
    this.reconnectAttempt += 1
    this.setPhase('reconnecting')
    this.clearAudioPlayback()
    this.stopPingKeepalive()
    if (this.ws) {
      try { this.ws.close() } catch {}
      this.ws = null
    }
    this.isConnected = false

    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempt - 1), 4000)
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.phase === 'reconnecting' && !this.isManuallyStopped) {
        this.reconnect().catch((err) => {
          console.warn('[VoiceAudioEngine] Reconnect failed:', err)
          if (this.reconnectAttempt >= this.maxReconnectAttempts) {
            this.fail('unreachable', '多次重连失败，请检查网络或后端服务')
            this.stop(false, true)
          } else {
            this.scheduleReconnect()
          }
        })
      }
    }, backoffMs)
  }

  private async reconnect(): Promise<void> {
    if (this.isManuallyStopped) return
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      await this.initAudioInput()
    }
    const wsUrl = this.buildWsUrl()
    this.ws = new WebSocket(wsUrl)
    this.ws.binaryType = 'arraybuffer'

    this.ws.onopen = () => {
      this.isConnected = true
      this.reconnectAttempt = 0
      if (this.options.memory !== undefined && this.ws !== null && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'config', memory: this.options.memory }))
      }
      this.startPingKeepalive()
      this.setPhase('listening')
    }

    this.ws.onmessage = (event) => {
      this.handleWsMessage(event.data)
    }

    this.ws.onerror = () => {
      // Handled by onclose
    }

    this.ws.onclose = (ev) => {
      this.stopPingKeepalive()
      if (this.serverErrorMessage !== undefined) {
        this.fail('server', this.serverErrorMessage)
        this.stop(false, true)
        return
      }
      if (ev.code === 1008) {
        this.fail('auth', `close ${ev.code}`)
        this.stop(false, true)
        return
      }
      if (!this.isManuallyStopped && this.reconnectAttempt < this.maxReconnectAttempts) {
        this.scheduleReconnect()
      } else {
        this.fail('unreachable', `reconnect close ${ev.code}`)
        this.stop(false, true)
      }
    }
  }

  private startPingKeepalive(): void {
    this.stopPingKeepalive()
    this.pingIntervalId = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }))
        } catch {}
      }
    }, 25_000)
  }

  private stopPingKeepalive(): void {
    if (this.pingIntervalId !== null) {
      clearInterval(this.pingIntervalId)
      this.pingIntervalId = null
    }
  }

  /**
   * Tear the audio pipeline and socket down.
   * @param sendClose - close the WebSocket politely when open.
   * @param keepError - keep the error phase (and its message) visible after teardown.
   */
  public stop(sendClose: boolean = true, keepError: boolean = false): void {
    this.isManuallyStopped = true
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopPingKeepalive()
    if (this.aliveTimer !== null) {
      clearTimeout(this.aliveTimer)
      this.aliveTimer = null
    }
    this.stopLevelMonitor()
    this.clearAudioPlayback()
    this.commitTurnIfPending()

    if (this.micWorkletNode) {
      try {
        this.micWorkletNode.port.close?.()
        this.micWorkletNode.disconnect()
      } catch {}
      this.micWorkletNode = null
    }
    if (this.workletBlobUrl) {
      try {
        URL.revokeObjectURL(this.workletBlobUrl)
      } catch {}
      this.workletBlobUrl = null
    }
    if (this.micProcessor) {
      this.micProcessor.disconnect()
      this.micProcessor = null
    }
    if (this.micSink) {
      this.micSink.disconnect()
      this.micSink = null
    }
    if (this.micSource) {
      this.micSource.disconnect()
      this.micSource = null
    }
    if (this.speakerGain) {
      this.speakerGain.disconnect()
      this.speakerGain = null
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop())
      this.mediaStream = null
    }
    if (this.deviceChangeListener && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      try {
        navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeListener)
      } catch {}
      this.deviceChangeListener = null
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.onstatechange = null
        this.audioCtx.close()
      } catch {}
      this.audioCtx = null
    }

    if (this.ws) {
      if (sendClose && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.close()
        } catch {}
      }
      this.ws = null
    }

    this.isConnected = false
    this.isPushToTalk = false
    this.wasMutedBeforePushToTalk = false
    this.reconnectAttempt = 0
    if (keepError && this.phase === 'error') {
      this.notifyState()
      return
    }
    this.setPhase('idle')
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted
    if (this.micGain) {
      this.micGain.gain.value = this.isMuted ? 0 : 1
    }
    if (this.micWorkletNode) {
      this.micWorkletNode.port.postMessage({ type: 'set_muted', muted: this.isMuted })
    }
    this.notifyState()
    return this.isMuted
  }

  public startPushToTalk(): void {
    if (!this.isConnected || this.isPushToTalk) return
    this.isPushToTalk = true
    this.wasMutedBeforePushToTalk = this.isMuted
    if (this.isMuted) {
      this.isMuted = false
      if (this.micGain) {
        this.micGain.gain.value = 1
      }
      if (this.micWorkletNode) {
        this.micWorkletNode.port.postMessage({ type: 'set_muted', muted: false })
      }
    }
    // If AI is speaking, interrupt to yield voice floor immediately
    if (this.phase === 'speaking') {
      this.interrupt()
    }
    this.notifyState()
  }

  public stopPushToTalk(): void {
    if (!this.isPushToTalk) return
    this.isPushToTalk = false
    if (this.wasMutedBeforePushToTalk) {
      this.isMuted = true
      if (this.micGain) {
        this.micGain.gain.value = 0
      }
      if (this.micWorkletNode) {
        this.micWorkletNode.port.postMessage({ type: 'set_muted', muted: true })
      }
    }
    this.notifyState()
  }

  public isPushToTalkActive(): boolean {
    return this.isPushToTalk
  }

  /**
   * Realtime Interruption / Barge-in trigger
   */
  public interrupt(): void {
    if (this.phase === 'speaking') {
      this.setPhase('interrupted')
      this.clearAudioPlayback()
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'interrupt' }))
      }
      setTimeout(() => {
        if (this.phase === 'interrupted') {
          this.setPhase('listening')
        }
      }, 500)
    }
  }

  /**
   * Send text message during realtime conversation
   */
  public sendText(text: string): boolean {
    const trimmed = text.trim()
    if (!trimmed || !this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    this.currentUserText = trimmed
    this.isUserInterim = false
    this.notifyTranscript()
    this.ws.send(JSON.stringify({ type: 'text_input', text: trimmed }))
    return true
  }

  private buildWsUrl(): string {
    const base = normalizeGatewayUrl(this.options.gatewayUrl)
    const url = new URL(base)
    if (this.options.provider) url.searchParams.set('provider', this.options.provider)
    if (this.options.model) url.searchParams.set('model', this.options.model)
    if (this.options.voice) url.searchParams.set('voice', this.options.voice)
    if (this.options.translationMode) url.searchParams.set('translation_mode', this.options.translationMode)
    if (this.options.sourceLanguage) url.searchParams.set('source_language_code', this.options.sourceLanguage)
    if (this.options.targetLanguage) url.searchParams.set('target_language_code', this.options.targetLanguage)
    if (this.options.echoTargetLanguage !== undefined) {
      url.searchParams.set('echo_target_language', String(this.options.echoTargetLanguage))
    }
    return url.toString()
  }

  private fail(code: VoiceEngineErrorCode, detail: string): void {
    this.errorCode = code
    this.errorMessage = detail
    this.setPhase('error')
    this.options.onError?.({ code, message: detail })
  }

  private async initAudioInput(): Promise<void> {
    const webkitWindow = window as Window & { webkitAudioContext?: typeof AudioContext }
    const AudioCtx = window.AudioContext ?? webkitWindow.webkitAudioContext
    if (AudioCtx === undefined) throw new Error('Web Audio API is unavailable in this browser')
    this.audioCtx = new AudioCtx()

    // Auto-resume audio context when suspended by browser autoplay policy or system sleep
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume()
    }
    this.audioCtx.onstatechange = () => {
      if (
        this.audioCtx &&
        this.audioCtx.state === 'suspended' &&
        this.isConnected &&
        !this.isManuallyStopped
      ) {
        this.audioCtx.resume().catch((err) => {
          console.warn('[VoiceAudioEngine] Auto-resume AudioContext failed:', err)
        })
      }
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        // @ts-expect-error voiceIsolation is an experimental standard constraint in Chrome/Safari
        voiceIsolation: true,
      },
    })

    // Listen for hardware/headset route changes
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
      this.deviceChangeListener = () => {
        const audioTracks = this.mediaStream?.getAudioTracks() ?? []
        const active = audioTracks.some((t) => t.readyState === 'live' && t.enabled)
        if (!active && this.isConnected && !this.isManuallyStopped) {
          console.warn('[VoiceAudioEngine] Audio input device disconnected or changed')
        }
      }
      navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeListener)
    }

    this.micSource = this.audioCtx.createMediaStreamSource(this.mediaStream)
    this.micGain = this.audioCtx.createGain()
    this.micAnalyser = this.audioCtx.createAnalyser()
    this.micAnalyser.fftSize = 256

    this.speakerGain = this.audioCtx.createGain()
    this.speakerGain.gain.setValueAtTime(1, this.audioCtx.currentTime)
    this.speakerAnalyser = this.audioCtx.createAnalyser()
    this.speakerAnalyser.fftSize = 256

    this.micSource.connect(this.micGain)
    this.micGain.connect(this.micAnalyser)

    this.speakerGain.connect(this.speakerAnalyser)
    this.speakerAnalyser.connect(this.audioCtx.destination)

    // Attempt to initialize high-performance AudioWorkletNode on dedicated thread
    let workletSuccess = false
    if (this.audioCtx.audioWorklet) {
      try {
        if (!this.workletBlobUrl) {
          const blob = new Blob([AUDIO_WORKLET_PROCESSOR_CODE], { type: 'application/javascript' })
          this.workletBlobUrl = URL.createObjectURL(blob)
        }
        await this.audioCtx.audioWorklet.addModule(this.workletBlobUrl)
        this.micWorkletNode = new AudioWorkletNode(this.audioCtx, 'voicespirit-audio-processor')
        this.micWorkletNode.port.postMessage({
          type: 'init',
          inputSampleRate: this.audioCtx.sampleRate,
          targetSampleRate: 16000,
        })
        this.micWorkletNode.port.postMessage({
          type: 'set_vad',
          enabled: this.options.vadEnabled !== false,
        })
        this.micWorkletNode.port.onmessage = (event) => {
          const data = event.data
          if (data && data.type === 'pcm' && data.pcm) {
            if (this.isConnected && !this.isMuted && this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(data.pcm)
            }
          }
        }
        this.micGain.connect(this.micWorkletNode)
        workletSuccess = true
      } catch (workletErr) {
        console.warn('[VoiceAudioEngine] AudioWorklet init failed, falling back to ScriptProcessorNode:', workletErr)
        workletSuccess = false
      }
    }

    // Fallback to ScriptProcessorNode if AudioWorklet is unsupported or blocked
    if (!workletSuccess) {
      this.initScriptProcessorFallback()
    }
  }

  private initScriptProcessorFallback(): void {
    if (!this.audioCtx || !this.micGain) return
    const bufferSize = 4096
    this.micProcessor = this.audioCtx.createScriptProcessor(bufferSize, 1, 1)
    const inputSampleRate = this.audioCtx.sampleRate
    const targetSampleRate = 16000
    const vadEnabled = this.options.vadEnabled !== false
    const hangoverMaxFrames = 3 // ~380ms at 4096 samples (85ms per frame)
    const silenceHeartbeatInterval = 18 // ~1.5s

    this.fallbackNoiseFloor = 0.005
    this.fallbackHangoverFrames = 0
    this.fallbackSilenceHeartbeatCounter = 0

    this.micProcessor.onaudioprocess = (e) => {
      if (!this.isConnected || this.isMuted) return
      const inputData = e.inputBuffer.getChannelData(0)
      const pcm16 = this.downsampleTo16k(inputData, inputSampleRate, targetSampleRate)
      if (pcm16.length === 0 || !this.ws || this.ws.readyState !== WebSocket.OPEN) return

      // Compute RMS energy
      let sumSquares = 0
      for (let i = 0; i < pcm16.length; i++) {
        const norm = (pcm16[i] ?? 0) / 32768
        sumSquares += norm * norm
      }
      const rms = Math.sqrt(sumSquares / pcm16.length)

      this.fallbackNoiseFloor = this.fallbackNoiseFloor * 0.98 + rms * 0.02
      const dynamicThreshold = Math.max(0.012, this.fallbackNoiseFloor * 2.2)

      const isVoice = rms > dynamicThreshold
      if (isVoice) {
        this.fallbackHangoverFrames = hangoverMaxFrames
      } else if (this.fallbackHangoverFrames > 0) {
        this.fallbackHangoverFrames--
      }

      const shouldSend = !vadEnabled || isVoice || this.fallbackHangoverFrames > 0
      if (shouldSend) {
        this.fallbackSilenceHeartbeatCounter = 0
        this.ws.send(pcm16.buffer as ArrayBuffer)
      } else {
        this.fallbackSilenceHeartbeatCounter++
        if (this.fallbackSilenceHeartbeatCounter >= silenceHeartbeatInterval) {
          this.fallbackSilenceHeartbeatCounter = 0
          this.ws.send(pcm16.buffer as ArrayBuffer)
        }
      }
    }

    this.micGain.connect(this.micProcessor)
    this.micSink = this.audioCtx.createGain()
    this.micSink.gain.value = 0
    this.micProcessor.connect(this.micSink)
    this.micSink.connect(this.audioCtx.destination)
  }

  private commitTurnIfPending(newTurnId?: string, isInterrupted?: boolean): void {
    const user = this.currentUserText.trim()
    const assistant = this.currentAssistantText.trim()
    const translation = this.currentTranslationText.trim()
    if (user || assistant || translation) {
      const turn: VoiceTranscriptTurn = {
        id: this.currentTurnId || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userText: user,
        assistantText: assistant,
        translationText: translation || undefined,
        sourceLanguage: this.options.sourceLanguage,
        targetLanguage: this.options.targetLanguage,
        timestamp: Date.now(),
        interrupted: isInterrupted ?? this.currentTurnInterrupted,
      }
      this.options.onTurnComplete?.(turn)
    }
    this.currentUserText = ''
    this.currentAssistantText = ''
    this.currentTranslationText = ''
    this.isUserInterim = false
    this.currentTurnInterrupted = false
    if (newTurnId !== undefined) {
      this.currentTurnId = newTurnId
    }
  }

  private handleWsMessage(data: string | ArrayBuffer): void {
    this.receivedAnyMessage = true
    if (this.aliveTimer !== null) {
      clearTimeout(this.aliveTimer)
      this.aliveTimer = null
    }
    try {
      let msg: VoiceServerEvent | undefined
      if (typeof data === 'string') {
        msg = JSON.parse(data) as VoiceServerEvent
      } else if (data instanceof ArrayBuffer) {
        // Binary audio stream directly
        this.playAudioChunk(data, 24000)
        return
      }

      if (!msg) return

      switch (msg.type) {
        case 'speech_started':
          if (this.phase === 'speaking') {
            this.interrupt()
          }
          break

        case 'user_transcript':
        case 'transcript':
        case 'conversation.item.input_audio_transcription.text':
          if (msg.text !== undefined || msg.source_text !== undefined) {
            const incoming = msg.text ?? msg.source_text ?? ''
            const isInterim = msg.interim ?? false

            // If assistant had already replied in the current turn and new user speech arrived,
            // or if turn_id changed, commit the previous completed turn
            const hasPendingReply = this.currentAssistantText.trim().length > 0 || this.currentTranslationText.trim().length > 0
            const turnChanged = Boolean(msg.turn_id && this.currentTurnId && msg.turn_id !== this.currentTurnId)
            if ((!isInterim && hasPendingReply) || turnChanged) {
              this.commitTurnIfPending(msg.turn_id)
            }

            if (msg.turn_id) {
              this.currentTurnId = msg.turn_id
            }

            this.currentUserText = incoming
            this.isUserInterim = isInterim
            this.notifyTranscript()

            // If user started speaking while AI was playing, trigger interruption
            if (this.phase === 'speaking' && incoming.trim().length > 0) {
              this.interrupt()
            }
          }
          break

        case 'translation':
        case 'response.audio_transcript.text':
        case 'response.audio_transcript.done':
        case 'response.text.text':
        case 'response.text.done':
          if (msg.text || msg.translation || msg.target_text) {
            const incomingTranslation = msg.translation || msg.target_text || msg.text || ''
            if (msg.turn_id && this.currentTurnId && msg.turn_id !== this.currentTurnId) {
              this.commitTurnIfPending(msg.turn_id)
            }
            if (msg.turn_id) {
              this.currentTurnId = msg.turn_id
            }
            this.currentTranslationText = msg.cumulative
              ? mergeAssistantText(this.currentTranslationText, incomingTranslation)
              : appendAssistantDelta(this.currentTranslationText, incomingTranslation)
            this.notifyTranscript()
          }
          break

        case 'assistant_text':
        case 'reply':
        case 'delta':
          if (msg.text) {
            if (msg.turn_id && this.currentTurnId && msg.turn_id !== this.currentTurnId) {
              this.commitTurnIfPending(msg.turn_id)
            }
            if (msg.turn_id) {
              this.currentTurnId = msg.turn_id
            }
            // A cumulative event carries the whole transcript so far (or a
            // final canonical correction) and supersedes what streamed;
            // anything else is a verbatim delta that must be appended exactly
            // as sent — the ASR-hypothesis merger would split BPE words
            // (" wonder" + "ful" -> "wonder ful") and drop repeated fragments.
            this.currentAssistantText = msg.cumulative
              ? mergeAssistantText(this.currentAssistantText, msg.text)
              : appendAssistantDelta(this.currentAssistantText, msg.text)
            this.notifyTranscript()
          }
          break

        case 'assistant_audio':
        case 'audio': {
          const base64Data = msg.audio || msg.data
          if (base64Data) {
            const audioBuffer = this.base64ToArrayBuffer(base64Data)
            const sampleRate = msg.sample_rate || 24000
            this.setPhase('speaking')
            this.playAudioChunk(audioBuffer, sampleRate)
          }
          break
        }

        case 'interruption':
        case 'interrupted':
        case 'interruption_pending':
          this.currentTurnInterrupted = true
          this.setPhase('interrupted')
          this.clearAudioPlayback()
          setTimeout(() => {
            if (this.phase === 'interrupted') {
              this.setPhase('listening')
            }
          }, 400)
          break

        case 'turn_complete':
        case 'turn_end':
          this.commitTurnIfPending(undefined, msg.interrupted)
          this.setPhase('listening')
          break

        case 'memory_config':
          this.memory = {
            active: msg.enabled === true,
            scope: typeof msg.scope === 'string' ? msg.scope : '',
            group: typeof msg.group_id === 'string' ? msg.group_id : '',
            retrieved: 0,
            saved: 0,
            writeReason: '',
          }
          this.notifyState()
          break

        case 'memory_context':
          if (this.memory !== undefined && msg.attempted !== false) {
            this.memory = {
              ...this.memory,
              retrieved: typeof msg.memories_retrieved === 'number' ? msg.memories_retrieved : 0,
            }
            this.notifyState()
          }
          break

        case 'memory_write':
          if (this.memory !== undefined) {
            this.memory = {
              ...this.memory,
              saved: typeof msg.saved_count === 'number' ? msg.saved_count : 0,
              writeReason: typeof msg.reason === 'string' ? msg.reason : '',
            }
            this.notifyState()
          }
          break

        case 'error': {
          console.error('[VoiceAudioEngine] Server error message:', msg.message)
          const serverMessage = typeof msg.message === 'string' && msg.message !== ''
            ? msg.message
            : 'voice service error'
          this.serverErrorMessage = serverMessage
          // Immediately transition to error state and disconnect — previously
          // the engine only recorded the error but kept the 'listening' phase,
          // so the user would see "Listening…" while the backend had already
          // refused to process audio (e.g. missing API key).
          this.fail('server', serverMessage)
          this.stop(false, true)
          break
        }
      }
    } catch (e) {
      console.warn('[VoiceAudioEngine] Failed to parse message:', e)
    }
  }

  private playAudioChunk(arrayBuffer: ArrayBuffer, sampleRate: number): void {
    if (!this.audioCtx) return

    const int16Array = new Int16Array(arrayBuffer)
    const float32Array = new Float32Array(int16Array.length)
    for (let i = 0; i < int16Array.length; i++) {
      const val = int16Array[i] ?? 0
      float32Array[i] = val / 32768
    }

    const audioBuf = this.audioCtx.createBuffer(1, float32Array.length, sampleRate)
    audioBuf.copyToChannel(float32Array, 0)

    const source = this.audioCtx.createBufferSource()
    source.buffer = audioBuf

    if (this.speakerGain) {
      const now = this.audioCtx.currentTime
      if (this.speakerGain.gain.value < 0.99) {
        this.speakerGain.gain.cancelScheduledValues(now)
        this.speakerGain.gain.setValueAtTime(this.speakerGain.gain.value, now)
        this.speakerGain.gain.linearRampToValueAtTime(1.0, now + 0.02)
      }
      source.connect(this.speakerGain)
    } else if (this.speakerAnalyser) {
      source.connect(this.speakerAnalyser)
      this.speakerAnalyser.connect(this.audioCtx.destination)
    } else {
      source.connect(this.audioCtx.destination)
    }

    const now = this.audioCtx.currentTime
    const startTime = Math.max(now, this.nextPlaybackTime)
    source.start(startTime)
    this.nextPlaybackTime = startTime + audioBuf.duration
    this.activeSources.push(source)

    const generation = this.playbackGeneration
    source.onended = () => {
      const idx = this.activeSources.indexOf(source)
      if (idx !== -1) this.activeSources.splice(idx, 1)

      if (generation === this.playbackGeneration && this.activeSources.length === 0) {
        if (this.phase === 'speaking') {
          this.setPhase('listening')
        }
      }
    }
  }

  private clearAudioPlayback(): void {
    this.playbackGeneration += 1
    this.nextPlaybackTime = 0
    if (this.speakerGain && this.audioCtx) {
      const now = this.audioCtx.currentTime
      this.speakerGain.gain.cancelScheduledValues(now)
      this.speakerGain.gain.setValueAtTime(this.speakerGain.gain.value, now)
      // Smooth 40ms linear fade out to completely prevent pop / click
      this.speakerGain.gain.linearRampToValueAtTime(0.0001, now + 0.04)
    }
    const sourcesToStop = [...this.activeSources]
    this.activeSources = []
    setTimeout(() => {
      for (const src of sourcesToStop) {
        try {
          src.stop()
          src.disconnect()
        } catch {}
      }
    }, 45)
  }

  private startLevelMonitor(): void {
    if (this.levelIntervalId !== null) return
    const binCount = 128
    const micData = new Uint8Array(binCount)
    const spkData = new Uint8Array(binCount)

    // Log-spaced band edges over the voice-relevant range (~150 Hz – 7.5 kHz):
    // a linear split would leave every upper band dead, since both the mic
    // uplink and the playback path are band-limited telephony audio. The
    // sample rate is fixed per context, so the edges are computed once.
    const binHz = (this.audioCtx?.sampleRate ?? 48000) / (binCount * 2)
    const minBin = 2
    const maxBin = Math.max(minBin + SPECTRUM_BANDS, Math.min(binCount - 1, Math.floor(7500 / binHz)))
    const edges: number[] = []
    for (let i = 0; i <= SPECTRUM_BANDS; i++) {
      edges.push(Math.round(minBin * Math.pow(maxBin / minBin, i / SPECTRUM_BANDS)))
    }

    const intervalMs = typeof document !== 'undefined' && document.hidden ? 250 : 60

    this.levelIntervalId = window.setInterval(() => {
      let micVol = 0
      let spkVol = 0
      let micBands: number[] = new Array<number>(SPECTRUM_BANDS).fill(0)
      let spkBands: number[] = new Array<number>(SPECTRUM_BANDS).fill(0)

      if (this.micAnalyser) {
        this.micAnalyser.getByteFrequencyData(micData)
        let sum = 0
        for (let i = 0; i < micData.length; i++) sum += micData[i] ?? 0
        micVol = sum / micData.length / 255
        micBands = extractBands(micData, edges)
      }

      if (this.speakerAnalyser) {
        this.speakerAnalyser.getByteFrequencyData(spkData)
        let sum = 0
        for (let i = 0; i < spkData.length; i++) sum += spkData[i] ?? 0
        spkVol = sum / spkData.length / 255
        spkBands = extractBands(spkData, edges)
      }

      this.options.onLevelsChange?.(micVol, spkVol, micBands, spkBands)
    }, intervalMs)

    // Dynamically adjust polling frequency on tab visibility change to conserve CPU
    if (typeof document !== 'undefined' && this.visibilityListener === null) {
      this.visibilityListener = () => {
        if (this.levelIntervalId !== null) {
          clearInterval(this.levelIntervalId)
          this.levelIntervalId = null
          this.startLevelMonitor()
        }
      }
      document.addEventListener('visibilitychange', this.visibilityListener)
    }
  }

  private stopLevelMonitor(): void {
    if (this.levelIntervalId !== null) {
      clearInterval(this.levelIntervalId)
      this.levelIntervalId = null
    }
    if (typeof document !== 'undefined' && this.visibilityListener !== null) {
      document.removeEventListener('visibilitychange', this.visibilityListener)
      this.visibilityListener = null
    }
    this.options.onLevelsChange?.(0, 0, new Array<number>(SPECTRUM_BANDS).fill(0), new Array<number>(SPECTRUM_BANDS).fill(0))
  }

  private setPhase(phase: VoiceEnginePhase): void {
    this.phase = phase
    this.notifyState()
  }

  private notifyState(): void {
    this.options.onStateChange?.(this.getState())
  }

  private notifyTranscript(): void {
    this.options.onTranscriptChange?.(
      this.currentUserText,
      this.isUserInterim,
      this.currentAssistantText,
      this.currentTranslationText,
    )
  }

  private downsampleTo16k(
    buffer: Float32Array,
    fromRate: number,
    toRate: number = 16000,
  ): Int16Array {
    if (fromRate === toRate) {
      const output = new Int16Array(buffer.length)
      for (let i = 0; i < buffer.length; i++) {
        const item = buffer[i] ?? 0
        const s = Math.max(-1, Math.min(1, item))
        output[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      return output
    }

    const ratio = fromRate / toRate
    const newLength = Math.round(buffer.length / ratio)
    const result = new Int16Array(newLength)
    let offsetResult = 0
    let offsetBuffer = 0

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio)
      let accum = 0
      let count = 0
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i] ?? 0
        count++
      }
      const val = count > 0 ? accum / count : 0
      const s = Math.max(-1, Math.min(1, val))
      result[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7fff
      offsetResult++
      offsetBuffer = nextOffsetBuffer
    }
    return result
  }


  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer as ArrayBuffer
  }
}
