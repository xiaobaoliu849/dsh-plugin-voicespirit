/**
 * Browser face of the harness-host VoiceSpirit routes (`/api/voicespirit/*`):
 * status polling with a snapshot store, backend start/stop, the settings
 * proxy, and model discovery. The realtime audio path does not go through
 * here — the engine's WebSocket targets the host proxy route directly.
 */

import {
  createSnapshotStore,
  type SnapshotStore,
} from '@deepseek-ai/dsh-client-store'
import type {
  BackendSettingsDocument, BackendStatus, VoiceSpiritStatusResponse,
} from './contract/settings.ts'

/** What the store publishes; `error` carries the last failed call's message. */
export interface VoiceSpiritBackendState {
  /** undefined until the first status answer settles. */
  backend: BackendStatus | undefined
  /** True between a status dispatch and its settlement. */
  loading: boolean
  /** True while a start/stop command is in flight. */
  commanding: boolean
  /** Last failure message (status fetch or command), or undefined. */
  error: string | undefined
}

const API_ROOT = '/api/voicespirit'

export class VoiceSpiritBackend {
  private readonly store: SnapshotStore<VoiceSpiritBackendState>
  private pollTimer: number | null = null
  private pollGeneration = 0

  constructor() {
    this.store = createSnapshotStore<VoiceSpiritBackendState>({
      backend: undefined,
      loading: false,
      commanding: false,
      error: undefined,
    })
  }

  /** Current published state (stable reference between changes). */
  getSnapshot(): VoiceSpiritBackendState {
    return this.store.getSnapshot()
  }

  subscribe(listener: () => void): () => void {
    return this.store.subscribe(listener)
  }

  /** One status refresh; failures land in `error` without throwing. */
  async refresh(): Promise<void> {
    const generation = ++this.pollGeneration
    this.store.update((draft) => { draft.loading = true })
    try {
      const response = await fetch(`${API_ROOT}/status`, { signal: AbortSignal.timeout(8000) })
      const body = await response.json() as VoiceSpiritStatusResponse
      if (generation !== this.pollGeneration) return
      this.store.update((draft) => {
        if (body.ok && body.backend !== undefined) draft.backend = body.backend
        else draft.error = 'status unavailable'
        draft.loading = false
      })
    } catch (error) {
      if (generation !== this.pollGeneration) return
      this.store.update((draft) => {
        draft.error = error instanceof Error ? error.message : String(error)
        draft.loading = false
      })
    }
  }

  /** Poll status every `intervalMs` while any listener is attached. */
  startPolling(intervalMs = 6000): void {
    if (this.pollTimer !== null) return
    void this.refresh()
    this.pollTimer = window.setInterval(() => { void this.refresh() }, intervalMs)
  }

  stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  /** Ask the host to bring the backend up; resolves with the post-start status. */
  async start(): Promise<BackendStatus | undefined> {
    return this.command(`${API_ROOT}/backend/start`, 'start failed')
  }

  /** Ask the host to stop the backend it spawned. */
  async stop(): Promise<BackendStatus | undefined> {
    return this.command(`${API_ROOT}/backend/stop`, 'stop failed')
  }

  /** Recent backend output lines for the diagnostics view. */
  async fetchLog(lines = 120): Promise<string[]> {
    try {
      const response = await fetch(`${API_ROOT}/backend/log?lines=${String(lines)}`, {
        signal: AbortSignal.timeout(8000),
      })
      const body = await response.json() as { ok: boolean, lines?: string[] }
      return body.ok && Array.isArray(body.lines) ? body.lines : []
    } catch {
      return []
    }
  }

  /** The backend's settings document through the host proxy. */
  async fetchSettings(): Promise<BackendSettingsDocument | undefined> {
    const result = await this.proxy(`${API_ROOT}/settings`, { method: 'GET' })
    return result.ok ? result.value as BackendSettingsDocument : undefined
  }

  /**
   * Deep-merge a patch into the backend settings document.
   * @returns the failure message, or undefined when the write landed.
   */
  async saveSettings(patch: Record<string, unknown>): Promise<string | undefined> {
    const result = await this.proxy(`${API_ROOT}/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    return result.ok ? undefined : result.error
  }

  /**
   * Register (or reuse) an EverMemOS conversation group through the host, which
   * composes the EverMem headers server-side from the stored memory settings.
   * @returns the resolved group id, or undefined when memory is not usable.
   */
  async fetchConversationMeta(groupId?: string): Promise<string | undefined> {
    try {
      const response = await fetch(`${API_ROOT}/evermem/conversation-meta`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(groupId === undefined ? {} : { groupId }),
        signal: AbortSignal.timeout(15_000),
      })
      const body = await response.json() as
        { ok: boolean, error?: string, value?: { group_id?: string } }
      const group = body.value?.group_id
      return response.ok && body.ok && typeof group === 'string' && group.trim() !== ''
        ? group.trim()
        : undefined
    } catch {
      return undefined
    }
  }

  /**
   * Fetch custom designed or cloned voices from backend.
   */
  async fetchCustomVoices(
    voiceType: 'voice_design' | 'voice_clone' = 'voice_design',
    provider = 'qwen',
  ): Promise<
    | { ok: true; voices: Array<{ voice: string; preferred_name?: string; type?: string; provider?: string }> }
    | { ok: false; error: string }
  > {
    const result = await this.proxy(`${API_ROOT}/voices/list?voice_type=${encodeURIComponent(voiceType)}&provider=${encodeURIComponent(provider)}`, {
      method: 'GET',
    })
    if (!result.ok) return result
    const list = (result.value as { voices?: Array<{ voice: string; preferred_name?: string; type?: string; provider?: string }> })?.voices
    return { ok: true, voices: Array.isArray(list) ? list : [] }
  }

  /**
   * Create a new voice via Voice Design prompt.
   */
  async createVoiceDesign(payload: {
    voice_prompt: string
    preview_text: string
    preferred_name: string
    language?: string
    provider?: string
  }): Promise<{ ok: true, value: unknown } | { ok: false, error: string }> {
    return this.proxy(`${API_ROOT}/voices/design`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  /**
   * Delete a custom voice.
   */
  async deleteCustomVoice(voiceName: string, voiceType: 'voice_design' | 'voice_clone' = 'voice_design', provider = 'qwen'):
    Promise<{ ok: true } | { ok: false, error: string }> {
    const result = await this.proxy(`${API_ROOT}/voices/delete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ voiceName, voiceType, provider }),
    })
    return result.ok ? { ok: true } : { ok: false, error: result.error }
  }

  /**
   * List Tavus interactive video pals.
   */
  async fetchTavusPals(): Promise<{ ok: true, pals: Array<{ pal_id: string; pal_name: string }> } | { ok: false, error: string }> {
    const result = await this.proxy(`${API_ROOT}/tavus/pals`, { method: 'GET' })
    if (!result.ok) return result
    const pals = (result.value as { pals?: Array<{ pal_id: string; pal_name: string }> })?.pals
    return { ok: true, pals: Array.isArray(pals) ? pals : [] }
  }

  /**
   * Create a Tavus video conversation session.
   */
  async createTavusConversation(payload: { pal_id?: string; conversation_name?: string }):
    Promise<{ ok: true, conversationUrl: string; conversationId: string } | { ok: false, error: string }> {
    const result = await this.proxy(`${API_ROOT}/tavus/conversations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!result.ok) return result
    const val = result.value as { conversation_url?: string; conversation_id?: string }
    if (typeof val?.conversation_url === 'string' && val.conversation_url !== '') {
      return { ok: true, conversationUrl: val.conversation_url, conversationId: val.conversation_id ?? '' }
    }
    return { ok: false, error: 'No conversation_url in Tavus response' }
  }

  /**
   * Ask the backend to list a provider's models with a candidate credential.
   * @returns the model ids, or the failure message.
   */
  async fetchModels(provider: string, apiKey?: string, baseUrl?: string):
    Promise<{ ok: true, models: string[] } | { ok: false, error: string }> {
    try {
      const response = await fetch(`${API_ROOT}/models/fetch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider,
          ...(apiKey ? { apiKey } : {}),
          ...(baseUrl ? { baseUrl } : {}),
        }),
        signal: AbortSignal.timeout(20_000),
      })
      const body = await response.json() as
        { ok: boolean, error?: string, value?: { models?: string[] } }
      if (!response.ok || !body.ok) {
        return { ok: false, error: body.error ?? `HTTP ${String(response.status)}` }
      }
      return { ok: true, models: Array.isArray(body.value?.models) ? body.value.models : [] }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async command(url: string, failure: string): Promise<BackendStatus | undefined> {
    this.store.update((draft) => { draft.commanding = true })
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(90_000),
      })
      const body = await response.json() as { ok?: boolean, backend?: BackendStatus, error?: string }
      this.store.update((draft) => {
        if (body.backend !== undefined) draft.backend = body.backend
        draft.error = body.ok ? undefined : (body.error ?? failure)
        draft.commanding = false
      })
      return body.backend
    } catch (error) {
      this.store.update((draft) => {
        draft.error = error instanceof Error ? error.message : failure
        draft.commanding = false
      })
      return undefined
    }
  }

  private async proxy(url: string, init: RequestInit):
    Promise<{ ok: true, value: unknown } | { ok: false, error: string }> {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) })
      const body = await response.json().catch(() => undefined) as
        { ok?: boolean, value?: unknown, error?: string } | undefined
      if (!response.ok || body?.ok !== true) {
        return { ok: false, error: body?.error ?? `HTTP ${String(response.status)}` }
      }
      return { ok: true, value: body.value }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}
