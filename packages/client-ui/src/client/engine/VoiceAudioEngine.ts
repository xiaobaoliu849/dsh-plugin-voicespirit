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

export type VoiceEnginePhase = 'idle' | 'connecting' | 'listening' | 'speaking' | 'interrupted' | 'error'

/** Stable error classes the UI translates; the raw message rides alongside. */
export type VoiceEngineErrorCode = 'auth' | 'unreachable' | 'microphone' | 'server' | 'unknown'

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
  /** EverMemOS payload sent in the session `config` message; undefined = memory off. */
  memory?: EvermemSessionConfig | undefined
  onStateChange?: ((state: VoiceEngineState) => void) | undefined
  onLevelsChange?: ((micLevel: number, speakerLevel: number, micBands: number[], speakerBands: number[]) => void) | undefined
  onTranscriptChange?: ((userText: string, isInterim: boolean, assistantText: string) => void) | undefined
  onTurnComplete?: ((turn: VoiceTranscriptTurn) => void) | undefined
  onError?: ((error: { code: VoiceEngineErrorCode, message: string }) => void) | undefined
}

export interface VoiceTranscriptTurn {
  id: string
  userText: string
  assistantText: string
  timestamp: number
  interrupted?: boolean
}

/** JSON control events the backend streams alongside binary audio frames. */
interface VoiceServerEvent {
  type?: string
  text?: string
  interim?: boolean
  audio?: string
  data?: string
  sample_rate?: number
  turn_id?: string
  interrupted?: boolean
  message?: string
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

export class VoiceAudioEngine {
  private options: VoiceCallOptions
  private audioCtx: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private micProcessor: ScriptProcessorNode | null = null
  private micAnalyser: AnalyserNode | null = null
  private speakerAnalyser: AnalyserNode | null = null
  private micGain: GainNode | null = null
  private micSink: GainNode | null = null

  private ws: WebSocket | null = null
  private isMuted: boolean = false
  private isConnected: boolean = false
  private phase: VoiceEnginePhase = 'idle'
  private errorMessage: string = ''
  private errorCode: VoiceEngineErrorCode = 'unknown'
  private memory: VoiceMemoryState | undefined

  private currentUserText: string = ''
  private currentAssistantText: string = ''
  private isUserInterim: boolean = false

  // Last `error` event text from the backend; takes precedence over the
  // generic close-code diagnosis so config problems surface verbatim.
  private serverErrorMessage: string | undefined

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

    this.setPhase('connecting')
    this.errorMessage = ''
    this.errorCode = 'unknown'
    this.serverErrorMessage = undefined
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
        // Memory config rides the first client message: the backend applies it
        // to every subsequent turn (retrieval injection + turn-final writes).
        if (this.options.memory !== undefined && this.ws !== null && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'config', memory: this.options.memory }))
        }
        this.setPhase('listening')
      }

      this.ws.onmessage = (event) => {
        this.handleWsMessage(event.data)
      }

      this.ws.onerror = () => {
        this.fail('unreachable', 'VOICE_ENGINE_WS_ERROR')
      }

      this.ws.onclose = (ev) => {
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
      console.error('[VoiceAudioEngine] Failed to start:', err)
      const message = err instanceof Error ? err.message : 'microphone unavailable'
      this.fail('microphone', message)
      this.stop(false)
    }
  }

  /**
   * Tear the audio pipeline and socket down.
   * @param sendClose - close the WebSocket politely when open.
   * @param keepError - keep the error phase (and its message) visible after teardown.
   */
  public stop(sendClose: boolean = true, keepError: boolean = false): void {
    this.stopLevelMonitor()
    this.clearAudioPlayback()

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
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop())
      this.mediaStream = null
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
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
    this.notifyState()
    return this.isMuted
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
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume()
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    this.micSource = this.audioCtx.createMediaStreamSource(this.mediaStream)
    this.micGain = this.audioCtx.createGain()
    this.micAnalyser = this.audioCtx.createAnalyser()
    this.micAnalyser.fftSize = 256

    this.speakerAnalyser = this.audioCtx.createAnalyser()
    this.speakerAnalyser.fftSize = 256

    this.micSource.connect(this.micGain)
    this.micGain.connect(this.micAnalyser)

    // Setup ScriptProcessor for downsampling & streaming 16kHz PCM chunks
    const bufferSize = 4096
    this.micProcessor = this.audioCtx.createScriptProcessor(bufferSize, 1, 1)
    const inputSampleRate = this.audioCtx.sampleRate
    const targetSampleRate = 16000

    this.micProcessor.onaudioprocess = (e) => {
      if (!this.isConnected || this.isMuted) return
      const inputData = e.inputBuffer.getChannelData(0)
      const pcm16 = this.downsampleTo16k(inputData, inputSampleRate, targetSampleRate)
      if (pcm16.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send raw binary PCM 16-bit 16kHz audio frame directly to backend.
        // The buffer is freshly allocated above, so it is a plain ArrayBuffer.
        this.ws.send(pcm16.buffer as ArrayBuffer)
      }
    }

    this.micGain.connect(this.micProcessor)
    // ScriptProcessorNode only runs when wired into the destination graph, but
    // a direct connection would play the microphone back out loud. A zero-gain
    // sink keeps the graph alive without monitoring the input.
    this.micSink = this.audioCtx.createGain()
    this.micSink.gain.value = 0
    this.micProcessor.connect(this.micSink)
    this.micSink.connect(this.audioCtx.destination)
  }

  private handleWsMessage(data: string | ArrayBuffer): void {
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
        case 'user_transcript':
        case 'transcript':
          if (msg.text !== undefined) {
            this.currentUserText = msg.text
            this.isUserInterim = msg.interim ?? false
            this.notifyTranscript()

            // If user started speaking while AI was playing, trigger interruption
            if (this.phase === 'speaking' && msg.text.trim().length > 0) {
              this.interrupt()
            }
          }
          break

        case 'assistant_text':
        case 'reply':
        case 'delta':
          if (msg.text) {
            this.currentAssistantText += msg.text
            this.notifyTranscript()
          }
          break

        case 'assistant_audio':
        case 'audio':
          const base64Data = msg.audio || msg.data
          if (base64Data) {
            const audioBuffer = this.base64ToArrayBuffer(base64Data)
            const sampleRate = msg.sample_rate || 24000
            this.setPhase('speaking')
            this.playAudioChunk(audioBuffer, sampleRate)
          }
          break

        case 'interruption':
        case 'interrupted':
        case 'interruption_pending':
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
          if (this.currentUserText || this.currentAssistantText) {
            const turn: VoiceTranscriptTurn = {
              id: msg.turn_id || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              userText: this.currentUserText,
              assistantText: this.currentAssistantText,
              timestamp: Date.now(),
              interrupted: msg.interrupted ?? false,
            }
            this.options.onTurnComplete?.(turn)
          }
          this.currentUserText = ''
          this.currentAssistantText = ''
          this.isUserInterim = false
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
          this.errorCode = 'server'
          this.errorMessage = serverMessage
          this.options.onError?.({ code: 'server', message: serverMessage })
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

    if (this.speakerAnalyser) {
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
    for (const src of this.activeSources) {
      try {
        src.stop()
        src.disconnect()
      } catch {}
    }
    this.activeSources = []
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
    }, 60)
  }

  private stopLevelMonitor(): void {
    if (this.levelIntervalId !== null) {
      clearInterval(this.levelIntervalId)
      this.levelIntervalId = null
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
