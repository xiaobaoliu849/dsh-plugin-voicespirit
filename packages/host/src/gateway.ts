/**
 * VoiceSpirit backend lifecycle: spawn, health, and the authenticated proxy
 * face the browser routes call through.
 *
 * The backend is the FastAPI app in the VoiceSpirit checkout (`main.py`,
 * uvicorn). The harness owns the process it spawns — a random API/admin token
 * is injected through the environment, so the proxied settings reads/writes
 * and the realtime WebSocket handshake authenticate without any user
 * credential. A backend already listening on the port (started by the desktop
 * app or by hand) is adopted as-is; authenticating with it then requires the
 * user-level `apiToken` setting.
 */

import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import type { ChildProcess } from 'node:child_process'
import type { Context } from '@deepseek-ai/cordis'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type { VoiceSpiritSettings } from './settings.ts'

/** Lifecycle phase of the backend as the status route reports it. */
export type GatewayPhase = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

/** Backend facts the status route composes from the probe and the process table. */
export interface GatewayStatus {
  /** Lifecycle phase. */
  phase: GatewayPhase
  /** Whether the answering process was spawned by this harness (token in hand). */
  managed: boolean
  /** Child process id when spawned here. */
  pid: number | undefined
  /** Loopback port the backend is expected on. */
  port: number
  /** Backend checkout the launch resolves to. */
  backendDir: string
  /** Resolved data directory handed to the backend. */
  dataDir: string
  /** Whether the backend reports auth enabled (GET / `auth_enabled`). */
  authEnabled: boolean | undefined
  /** Backend name/version string from GET /, when reachable. */
  version: string | undefined
  /** Whether the /health probe currently answers. */
  healthy: boolean
  /** Human-readable failure detail for phase `error`. */
  error: string | undefined
  /** ISO timestamp of the successful launch. */
  startedAt: string | undefined
}

/** Everything the settings routes need to answer one proxied backend call. */
interface BackendProbe {
  healthy: boolean
  authEnabled: boolean | undefined
  version: string | undefined
}

const HEALTH_TIMEOUT_MS = 2500
const START_TIMEOUT_MS = 60_000
const START_POLL_MS = 700
const LOG_CAPACITY = 400

/** Ring of recent backend output lines, newest last, for the diagnostics view. */
export class GatewayLog {
  private readonly lines: string[] = []

  append(line: string): void {
    this.lines.push(line)
    if (this.lines.length > LOG_CAPACITY) this.lines.splice(0, this.lines.length - LOG_CAPACITY)
  }

  tail(count: number): string[] {
    return this.lines.slice(-Math.max(1, Math.min(count, LOG_CAPACITY)))
  }
}

/**
 * Owns the backend process and the proxy face. One instance per plugin; all
 * methods are safe to call concurrently — start/stop serialize on an internal
 * tail promise so a double click cannot spawn two uvicorns.
 */
export class VoiceSpiritGateway {
  private child: ChildProcess | undefined
  private phase: GatewayPhase = 'stopped'
  private phaseError: string | undefined
  private startedAt: string | undefined
  private spawnedToken: string | undefined
  private lastProbe: BackendProbe = { healthy: false, authEnabled: undefined, version: undefined }
  private tail: Promise<unknown> = Promise.resolve()

  /** Backend output ring, surfaced through the log route. */
  readonly log = new GatewayLog()

  constructor(
    private readonly logger: Context['logger'],
    private readonly readSettings: () => VoiceSpiritSettings,
  ) {}

  /** The settings snapshot this gateway last resolved. */
  get settings(): VoiceSpiritSettings {
    return this.readSettings()
  }

  /** Loopback base URL of the backend. */
  get baseUrl(): string {
    return `http://127.0.0.1:${this.settings.port}`
  }

  /** Current status, probing the backend without starting anything. */
  async status(): Promise<GatewayStatus> {
    const settings = this.settings
    const backendDir = this.resolveBackendDir(settings)
    const probe = await this.probe()
    const phase: GatewayPhase = this.phase === 'running' || this.phase === 'starting'
      ? (probe.healthy ? 'running' : this.phase)
      : this.phase
    return {
      phase,
      managed: this.spawnedToken !== undefined,
      pid: this.child?.pid,
      port: settings.port,
      backendDir: backendDir ?? settings.backendDir,
      dataDir: this.resolveDataDir(settings) ?? '',
      authEnabled: probe.authEnabled,
      version: probe.version,
      healthy: probe.healthy,
      error: this.phaseError,
      startedAt: this.startedAt,
    }
  }

  /**
   * Ensure the backend answers /health, spawning it when nothing is there.
   * Adopts an already-listening backend untouched (its auth then governs).
   * @returns the status after the wait; `healthy` false with `error` set on failure.
   */
  async start(): Promise<GatewayStatus> {
    const run = this.tail.then(() => this.startOnce())
    this.tail = run.catch(() => {})
    return run
  }

  /**
   * Stop the process this plugin spawned. An adopted backend is left running —
   * the harness did not start it, so stopping it would reach past its owner.
   */
  async stop(): Promise<GatewayStatus> {
    const run = this.tail.then(() => this.stopOnce())
    this.tail = run.catch(() => {})
    return run
  }

  /**
   * Authenticated GET of the backend's settings document.
   * @returns the parsed body, or an error shape the route maps to a status code.
   */
  async getBackendSettings(): Promise<
    { ok: true; value: unknown } | { ok: false; status: number; message: string }
  > {
    return this.proxyJson('/api/settings/', { method: 'GET' })
  }

  /**
   * Authenticated deep-merge PATCH of the backend's settings document.
   * @param patch - partial settings document (e.g. `{ api_keys: {...} }`).
   */
  async putBackendSettings(patch: unknown): Promise<
    { ok: true; value: unknown } | { ok: false; status: number; message: string }
  > {
    return this.proxyJson('/api/settings/', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ merge: true, settings: patch }),
    })
  }

  /**
   * Proxy a raw HTTP response (e.g. streaming TTS audio) with auth token attached.
   */
  async proxyRaw(path: string, init: RequestInit = {}, extraHeaders?: Record<string, string>): Promise<
    { ok: true; response: Response } | { ok: false; status: number; message: string }
  > {
    const probe = await this.probe()
    if (!probe.healthy) {
      return { ok: false, status: 503, message: 'VoiceSpirit backend is not running' }
    }
    const token = this.pickToken()
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
          ...extraHeaders,
        },
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) {
        return { ok: false, status: response.status, message: `backend answered ${String(response.status)}` }
      }
      return { ok: true, response }
    } catch (error) {
      return { ok: false, status: 502, message: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Ask the backend to list a provider's models with the given credential.
   * @param provider - provider name from the backend whitelist.
   * @param apiKey - optional key overriding the stored one for the probe.
   * @param baseUrl - optional base URL overriding the stored one.
   */
  async fetchProviderModels(provider: string, apiKey?: string, baseUrl?: string): Promise<
    { ok: true; value: unknown } | { ok: false; status: number; message: string }
  > {
    return this.proxyJson(`/api/settings/providers/${encodeURIComponent(provider)}/fetch-models`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(apiKey ? { api_key: apiKey } : {}),
        ...(baseUrl ? { base_url: baseUrl } : {}),
      }),
    })
  }

  /**
   * Register (or look up) an EverMemOS conversation group for this call. The
   * EverMem credentials never leave the server side of the harness: the
   * X-EverMem-* headers are composed here from the backend's stored
   * `memory_settings`, mirroring how the realtime session reads them from the
   * client `config` message.
   * @param groupId - existing group to reuse; empty creates a fresh group.
   */
  async createEvermemConversationMeta(groupId?: string): Promise<
    { ok: true; value: unknown } | { ok: false; status: number; message: string }
  > {
    const document = await this.getBackendSettings()
    if (!document.ok) return document
    const memory = readMemorySettings(document.value)
    if (memory === undefined || !memory.enabled || memory.api_key === '') {
      return { ok: false, status: 400, message: 'EverMem is not enabled or has no API key in the backend settings' }
    }
    if (memory.temporary_session) {
      return { ok: false, status: 400, message: 'EverMem temporary-session mode is on — memory writes are suspended' }
    }
    const normalizedGroup = (groupId ?? '').trim()
    return this.proxyJson('/api/evermem/conversation-meta', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(normalizedGroup === '' ? {} : { group_id: normalizedGroup }),
    }, evermemHeaders(memory))
  }

  /**
   * Bearer token for the realtime WebSocket handshake and the settings proxy.
   * The token this plugin injected at spawn time comes first; the user-level
   * token covers an adopted backend.
   */
  pickToken(): string | undefined {
    return this.spawnedToken ?? (this.settings.apiToken || undefined)
  }

  /** Upstream voice-chat WebSocket URL with auth folded in. */
  upstreamVoiceChatUrl(query: URLSearchParams): string {
    const settings = this.settings
    const token = this.pickToken()
    if (token !== undefined && !query.has('token')) query.set('token', token)
    return `ws://127.0.0.1:${settings.port}/api/voice-chat/ws?${query.toString()}`
  }

  /** Kill the spawned child and wait for the process table to settle. */
  async dispose(): Promise<void> {
    await this.stop()
  }

  private async startOnce(): Promise<GatewayStatus> {
    const settings = this.settings
    const probe = await this.probe()
    if (probe.healthy) {
      this.phase = 'running'
      this.lastProbe = probe
      return this.snapshot(settings, probe)
    }
    const backendDir = this.resolveBackendDir(settings)
    if (backendDir === undefined) {
      this.phase = 'error'
      this.phaseError = `VoiceSpirit backend directory not found (set backendDir; tried ${this.backendDirCandidates(settings).join(', ')})`
      this.logger.warn(this.phaseError)
      return this.snapshot(settings, { ...probe, healthy: false })
    }
    const entry = join(backendDir, 'main.py')
    if (!existsSync(entry)) {
      this.phase = 'error'
      this.phaseError = `${backendDir} has no main.py`
      this.logger.warn(this.phaseError)
      return this.snapshot(settings, { ...probe, healthy: false })
    }
    const python = this.resolvePython(settings, backendDir)
    if (python === undefined) {
      this.phase = 'error'
      this.phaseError = 'No Python interpreter found (set pythonPath in the VoiceSpirit settings)'
      this.logger.warn(this.phaseError)
      return this.snapshot(settings, { ...probe, healthy: false })
    }

    this.phase = 'starting'
    this.phaseError = undefined
    this.log.append(`[harness] launching ${python} -m uvicorn main:app --port ${settings.port}`)
    const token = randomBytes(24).toString('hex')
    const dataDir = this.resolveDataDir(settings)
    const child = spawn(python, [
      '-m', 'uvicorn', 'main:app',
      '--host', '127.0.0.1',
      '--port', String(settings.port),
    ], {
      cwd: backendDir,
      env: {
        ...process.env,
        ...(dataDir === undefined ? {} : { VOICESPIRIT_DATA_DIR: dataDir }),
        VOICESPIRIT_API_TOKEN: token,
        VOICESPIRIT_ADMIN_TOKEN: token,
        PYTHONIOENCODING: 'utf-8',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    this.child = child
    this.spawnedToken = token
    let spawnFailed = false
    child.stdout?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString('utf-8').split(/\r?\n/)) {
        if (line.trim() !== '') this.log.append(line)
      }
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString('utf-8').split(/\r?\n/)) {
        if (line.trim() !== '') this.log.append(line)
      }
    })
    child.on('error', (error: Error) => {
      spawnFailed = true
      this.phaseError = error.message
      this.phase = 'error'
      this.log.append(`[harness] spawn error: ${error.message}`)
    })
    child.on('exit', (code) => {
      this.log.append(`[harness] backend exited with code ${String(code)}`)
      if (this.child === child) {
        this.child = undefined
        this.spawnedToken = undefined
        if (this.phase !== 'stopping') {
          this.phase = 'stopped'
          this.phaseError = code === 0 ? undefined : `backend exited with code ${String(code)}`
        }
      }
    })

    const deadline = Date.now() + START_TIMEOUT_MS
    while (Date.now() < deadline) {
      if (spawnFailed) break
      await new Promise(resolveTimeout => setTimeout(resolveTimeout, START_POLL_MS))
      const poll = await this.probe()
      this.lastProbe = poll
      if (poll.healthy) {
        this.phase = 'running'
        this.startedAt = new Date().toISOString()
        this.phaseError = undefined
        this.log.append('[harness] backend healthy')
        return this.snapshot(settings, poll)
      }
    }
    if (!spawnFailed) {
      this.phase = this.child !== undefined ? 'error' : 'stopped'
      this.phaseError = `backend did not become healthy within ${Math.round(START_TIMEOUT_MS / 1000)}s — see the log view`
      this.logger.warn(this.phaseError)
    }
    return this.snapshot(settings, this.lastProbe)
  }

  private async stopOnce(): Promise<GatewayStatus> {
    const settings = this.settings
    const child = this.child
    if (child === undefined || this.spawnedToken === undefined) {
      // Nothing we own is running; an adopted backend stays untouched.
      this.phase = 'stopped'
      this.phaseError = undefined
      return this.snapshot(settings, await this.probe())
    }
    this.phase = 'stopping'
    this.spawnedToken = undefined
    await new Promise<void>((resolveKill) => {
      const timer = setTimeout(() => {
        if (child.pid !== undefined && process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
        } else {
          child.kill('SIGKILL')
        }
        resolveKill()
      }, 3000)
      child.once('exit', () => {
        clearTimeout(timer)
        resolveKill()
      })
      if (process.platform === 'win32' && child.pid !== undefined) {
        // uvicorn on Windows does not relay SIGTERM to its reload children.
        spawn('taskkill', ['/pid', String(child.pid), '/T'], { windowsHide: true })
      } else {
        child.kill('SIGTERM')
      }
    })
    this.child = undefined
    this.phase = 'stopped'
    this.startedAt = undefined
    this.log.append('[harness] backend stopped')
    return this.snapshot(settings, await this.probe())
  }

  /**
   * Proxy one JSON call to the backend with the strongest token in hand.
   * @param extraHeaders - appended after the auth header (EverMem forwarding).
   * @returns the parsed body, or `{ok: false}` with the backend status code.
   */
  private async proxyJson(path: string, init: RequestInit, extraHeaders?: Record<string, string>): Promise<
    { ok: true; value: unknown } | { ok: false; status: number; message: string }
  > {
    const probe = await this.probe()
    if (!probe.healthy) {
      return { ok: false, status: 503, message: 'VoiceSpirit backend is not running' }
    }
    const token = this.pickToken()
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
          ...extraHeaders,
        },
        signal: AbortSignal.timeout(15_000),
      })
      const body: unknown = await response.json().catch(() => undefined)
      if (!response.ok) {
        const detail = body as { detail?: { message?: string } | string } | undefined
        const message = typeof detail?.detail === 'string'
          ? detail.detail
          : detail?.detail?.message ?? `backend answered ${String(response.status)}`
        return { ok: false, status: response.status, message }
      }
      return { ok: true, value: body }
    } catch (error) {
      return { ok: false, status: 502, message: error instanceof Error ? error.message : String(error) }
    }
  }

  /** Probe /health and / once; never throws, never spawns. */
  private async probe(): Promise<BackendProbe> {
    try {
      const health = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) })
      if (!health.ok) {
        this.lastProbe = { healthy: false, authEnabled: this.lastProbe.authEnabled, version: this.lastProbe.version }
        return this.lastProbe
      }
      // / names the backend and whether it expects auth; failure there is not fatal.
      let authEnabled: boolean | undefined = this.lastProbe.authEnabled
      let version: string | undefined = this.lastProbe.version
      try {
        const root = await fetch(`${this.baseUrl}/`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) })
        if (root.ok) {
          const info = await root.json() as { version?: string; auth_enabled?: boolean }
          authEnabled = info.auth_enabled === true
          version = typeof info.version === 'string' ? info.version : undefined
        }
      } catch {
        // Root is informative only.
      }
      this.lastProbe = { healthy: true, authEnabled, version }
      return this.lastProbe
    } catch {
      this.lastProbe = { healthy: false, authEnabled: this.lastProbe.authEnabled, version: this.lastProbe.version }
      return this.lastProbe
    }
  }

  private snapshot(settings: VoiceSpiritSettings, probe: BackendProbe): GatewayStatus {
    const phase: GatewayPhase = probe.healthy ? 'running' : (this.phase === 'running' ? 'stopped' : this.phase)
    return {
      phase,
      managed: this.spawnedToken !== undefined,
      pid: this.child?.pid,
      port: settings.port,
      backendDir: this.resolveBackendDir(settings) ?? settings.backendDir,
      dataDir: this.resolveDataDir(settings) ?? '',
      authEnabled: probe.authEnabled,
      version: probe.version,
      healthy: probe.healthy,
      error: this.phaseError,
      startedAt: this.startedAt,
    }
  }

  private backendDirCandidates(settings: VoiceSpiritSettings): string[] {
    const configured = settings.backendDir.trim()
    if (configured !== '') {
      // Accept both the checkout root and its backend/ subdirectory.
      const root = resolve(configured)
      return [root, join(root, 'backend')]
    }
    return [
      'D:\\voicespirit\\backend',
      'D:\\voicespirit',
      resolve(dshHomePath('voicespirit'), 'backend'),
      join(process.env.USERPROFILE ?? process.env.HOME ?? '', 'voicespirit', 'backend'),
      join(process.env.USERPROFILE ?? process.env.HOME ?? '', 'voicespirit'),
    ].filter(entry => entry !== '')
  }

  /** First candidate directory that exists; undefined when none does. */
  private resolveBackendDir(settings: VoiceSpiritSettings): string | undefined {
    for (const candidate of this.backendDirCandidates(settings)) {
      if (existsSync(join(candidate, 'main.py'))) return candidate
    }
    return undefined
  }

  /**
   * Data directory handed to the backend through VOICESPIRIT_DATA_DIR. The
   * default is harness-owned: the backend seeds it from the checkout's legacy
   * config on first access (inheriting existing provider keys) while the DB —
   * and with it any desktop-app login requirement — stays separate.
   */
  private resolveDataDir(settings: VoiceSpiritSettings): string | undefined {
    const configured = settings.dataDir.trim()
    if (configured !== '') return resolve(configured)
    return dshHomePath('voicespirit')
  }

  /** Configured interpreter, else the checkout venvs, else PATH python. */
  private resolvePython(settings: VoiceSpiritSettings, backendDir: string): string | undefined {
    const configured = settings.pythonPath.trim()
    if (configured !== '') {
      const expanded = configured.startsWith('%') || configured.startsWith('~')
        ? configured
        : isAbsolute(configured) ? configured : resolve(configured)
      if (existsSync(expanded) || !expanded.includes('\\')) return expanded
    }
    const candidates = [
      join(backendDir, '.venv', 'Scripts', 'python.exe'),
      join(backendDir, '.venv', 'bin', 'python'),
      join(backendDir, 'venv', 'Scripts', 'python.exe'),
      join(backendDir, 'venv', 'bin', 'python'),
      resolve(backendDir, '..', 'venv', 'Scripts', 'python.exe'),
      resolve(backendDir, '..', 'venv', 'bin', 'python'),
    ]
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate
    }
    return process.platform === 'win32' ? 'python.exe' : 'python3'
  }
}

/** The EverMemOS section of the backend settings document. */
export interface BackendMemorySettings {
  enabled: boolean
  api_url: string
  api_key: string
  scope_id: string
  temporary_session: boolean
  remember_voice_chat: boolean
}

/**
 * Read the `memory_settings` section out of a backend settings document,
 * normalizing to strings/booleans with the backend's own defaults.
 */
export function readMemorySettings(document: unknown): BackendMemorySettings | undefined {
  if (typeof document !== 'object' || document === null) return undefined
  const settings = (document as { settings?: unknown }).settings ?? document
  if (typeof settings !== 'object' || settings === null) return undefined
  const raw = (settings as Record<string, unknown>)['memory_settings']
  if (typeof raw !== 'object' || raw === null) return undefined
  const memory = raw as Record<string, unknown>
  const text = (key: string): string => {
    const value = memory[key]
    return typeof value === 'string' ? value.trim() : ''
  }
  const flag = (key: string): boolean => memory[key] === true
  return {
    enabled: flag('enabled'),
    api_url: text('api_url') || 'https://api.evermind.ai',
    api_key: text('api_key'),
    scope_id: text('scope_id'),
    temporary_session: flag('temporary_session'),
    remember_voice_chat: memory['remember_voice_chat'] !== false,
  }
}

/** X-EverMem-* headers the backend's HTTP routes read the config from. */
function evermemHeaders(memory: BackendMemorySettings): Record<string, string> {
  return {
    'X-EverMem-Enabled': 'true',
    'X-EverMem-Url': memory.api_url,
    ...(memory.api_key === '' ? {} : { 'X-EverMem-Key': memory.api_key }),
    ...(memory.scope_id === '' ? {} : { 'X-EverMem-Scope': memory.scope_id }),
  }
}
