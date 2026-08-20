/**
 * Full-duplex WebAudio and WebSocket Engine for VoiceSpirit
 * Handles microphone downsampling to 16kHz PCM mono, streaming over WebSocket,
 * receiving and decoding low-latency audio chunks, dynamic volume monitoring,
 * and generational barge-in / interruption clearing.
 */

export type VoiceEnginePhase = 'idle' | 'connecting' | 'listening' | 'speaking' | 'interrupted' | 'error'

export interface VoiceEngineState {
  phase: VoiceEnginePhase
  isConnected: boolean
  isMuted: boolean
  provider: string
  model: string
  voice: string
  token?: string | undefined
  apiKey?: string | undefined
  errorMessage?: string | undefined
}

export interface VoiceCallOptions {
  gatewayUrl?: string | undefined
  provider?: string | undefined
  model?: string | undefined
  voice?: string | undefined
  token?: string | undefined
  apiKey?: string | undefined
  onStateChange?: ((state: VoiceEngineState) => void) | undefined
  onLevelsChange?: ((micLevel: number, speakerLevel: number) => void) | undefined
  onTranscriptChange?: ((userText: string, isInterim: boolean, assistantText: string) => void) | undefined
  onTurnComplete?: ((turn: VoiceTranscriptTurn) => void) | undefined
  onError?: ((error: string) => void) | undefined
}

export interface VoiceTranscriptTurn {
  id: string
  userText: string
  assistantText: string
  timestamp: number
  interrupted?: boolean
}

const STORAGE_KEY = 'voicespirit_plugin_config'
const DEFAULT_LOCAL_TOKEN = 'vsu.eyJhZG1pbiI6dHJ1ZSwiZXhwIjoxNzg5NzQ2ODA0LCJpYXQiOjE3ODcxNTQ4MDQsInN1YiI6IjM4MTQ1MDM5M0BxcS5jb20ifQ.PoPHWmVDvAyHfPnnLUEEJd3F9Ka2RdevoZ2NPfdATV4'

function normalizeGatewayUrl(url?: string): string {
  let base = (url || '').trim() || 'ws://127.0.0.1:8000/api/voice-chat/ws'
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

export class VoiceAudioEngine {
  private options: VoiceCallOptions
  private audioCtx: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private micProcessor: ScriptProcessorNode | null = null
  private micAnalyser: AnalyserNode | null = null
  private speakerAnalyser: AnalyserNode | null = null
  private micGain: GainNode | null = null

  private ws: WebSocket | null = null
  private isMuted: boolean = false
  private isConnected: boolean = false
  private phase: VoiceEnginePhase = 'idle'
  private errorMessage: string = ''

  private currentUserText: string = ''
  private currentAssistantText: string = ''
  private isUserInterim: boolean = false

  // Playback scheduler & interruption generation counter
  private playbackGeneration: number = 0
  private nextPlaybackTime: number = 0
  private activeSources: AudioBufferSourceNode[] = []

  private levelIntervalId: number | null = null

  constructor(options: VoiceCallOptions = {}) {
    let savedConfig: any = {}
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) savedConfig = JSON.parse(raw)
    } catch {}

    const resolvedGateway = normalizeGatewayUrl(savedConfig.gatewayUrl || options.gatewayUrl)

    let defaultProvider = options.provider || savedConfig.provider || 'Cartesia'
    let defaultModel = options.model || savedConfig.model || 'cartesia-realtime'
    let defaultVoice = options.voice || savedConfig.voice || 'f786b574-daa5-4673-aa0c-cbe3e8534c02'

    if (defaultModel === 'qwen-omni-turbo-realtime' || defaultModel === 'qwen3.5-omni-plus-realtime') {
      defaultProvider = 'Cartesia'
      defaultModel = 'cartesia-realtime'
      defaultVoice = 'f786b574-daa5-4673-aa0c-cbe3e8534c02'
    }

    this.options = {
      gatewayUrl: resolvedGateway,
      provider: defaultProvider,
      model: defaultModel,
      voice: defaultVoice,
      token: savedConfig.token || options.token || DEFAULT_LOCAL_TOKEN,
      apiKey: savedConfig.apiKey || options.apiKey || '',
      ...options,
    }
  }

  public updateOptions(newOptions: Partial<VoiceCallOptions>): void {
    if (newOptions.gatewayUrl) {
      newOptions.gatewayUrl = normalizeGatewayUrl(newOptions.gatewayUrl)
    }
    this.options = { ...this.options, ...newOptions }
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          gatewayUrl: this.options.gatewayUrl,
          provider: this.options.provider,
          model: this.options.model,
          voice: this.options.voice,
          token: this.options.token,
          apiKey: this.options.apiKey,
        }),
      )
    } catch {}
  }

  public getGatewayUrl(): string {
    return normalizeGatewayUrl(this.options.gatewayUrl)
  }

  public getState(): VoiceEngineState {
    return {
      phase: this.phase,
      isConnected: this.isConnected,
      isMuted: this.isMuted,
      provider: this.options.provider || 'Cartesia',
      model: this.options.model || 'cartesia-realtime',
      voice: this.options.voice || 'f786b574-daa5-4673-aa0c-cbe3e8534c02',
      token: this.options.token,
      apiKey: this.options.apiKey,
      errorMessage: this.errorMessage,
    }
  }

  public async start(): Promise<void> {
    if (this.isConnected || this.phase === 'connecting') return

    this.setPhase('connecting')
    this.errorMessage = ''

    try {
      // 1. Initialize WebAudio & Microphone
      await this.initAudioInput()

      // 2. Build WebSocket URL and Connect
      const wsUrl = this.buildWsUrl()
      console.log('[VoiceAudioEngine] Connecting to WebSocket:', wsUrl)
      this.ws = new WebSocket(wsUrl)
      this.ws.binaryType = 'arraybuffer'

      this.ws.onopen = () => {
        console.log('[VoiceAudioEngine] WebSocket connected!')
        this.isConnected = true
        this.setPhase('listening')
      }

      this.ws.onmessage = (event) => {
        this.handleWsMessage(event.data)
      }

      this.ws.onerror = (err) => {
        console.error('[VoiceAudioEngine] WebSocket error:', err)
        this.errorMessage = 'WebSocket 连接错误，请检查网关地址或鉴权 Token'
        this.setPhase('error')
        this.options.onError?.(this.errorMessage)
      }

      this.ws.onclose = (ev) => {
        console.log('[VoiceAudioEngine] WebSocket closed:', ev.code, ev.reason)
        if (ev.code === 1008) {
          this.errorMessage = '鉴权失败 (HTTP 403 / 1008): 请在语音设置中配置有效的 Token'
          this.setPhase('error')
          this.options.onError?.(this.errorMessage)
        }
        if (this.phase !== 'idle') {
          this.stop(false)
        }
      }

      this.startLevelMonitor()
    } catch (err: any) {
      console.error('[VoiceAudioEngine] Failed to start:', err)
      this.errorMessage = err.message || '无法访问麦克风或建立音频连接'
      this.setPhase('error')
      this.options.onError?.(this.errorMessage)
      this.stop(false)
    }
  }

  public stop(sendClose: boolean = true): void {
    this.stopLevelMonitor()
    this.clearAudioPlayback()

    if (this.micProcessor) {
      this.micProcessor.disconnect()
      this.micProcessor = null
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
    if (this.options.token) url.searchParams.set('token', this.options.token)
    if (this.options.apiKey) url.searchParams.set('api_key', this.options.apiKey)
    return url.toString()
  }

  private async initAudioInput(): Promise<void> {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
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
        // Send raw binary PCM 16-bit 16kHz audio frame directly to backend
        this.ws.send(pcm16.buffer as any)
      }
    }

    this.micGain.connect(this.micProcessor)
    this.micProcessor.connect(this.audioCtx.destination)
  }

  private handleWsMessage(data: any): void {
    try {
      let msg: any
      if (typeof data === 'string') {
        msg = JSON.parse(data)
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

        case 'error':
          console.error('[VoiceAudioEngine] Server error message:', msg.message)
          this.errorMessage = msg.message || '语音服务处理异常'
          this.options.onError?.(this.errorMessage)
          break
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
    const micData = new Uint8Array(128)
    const spkData = new Uint8Array(128)

    this.levelIntervalId = window.setInterval(() => {
      let micVol = 0
      let spkVol = 0

      if (this.micAnalyser) {
        this.micAnalyser.getByteFrequencyData(micData)
        let sum = 0
        for (let i = 0; i < micData.length; i++) sum += micData[i] ?? 0
        micVol = sum / micData.length / 255
      }

      if (this.speakerAnalyser) {
        this.speakerAnalyser.getByteFrequencyData(spkData)
        let sum = 0
        for (let i = 0; i < spkData.length; i++) sum += spkData[i] ?? 0
        spkVol = sum / spkData.length / 255
      }

      this.options.onLevelsChange?.(micVol, spkVol)
    }, 60)
  }

  private stopLevelMonitor(): void {
    if (this.levelIntervalId !== null) {
      clearInterval(this.levelIntervalId)
      this.levelIntervalId = null
    }
    this.options.onLevelsChange?.(0, 0)
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
