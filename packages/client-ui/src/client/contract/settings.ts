/**
 * The `voicespirit` settings contract shared by the settings card and the call
 * dock: the harness-side section (mirroring the host schema) plus the provider
 * catalog the quick switcher renders. Provider credentials live in the
 * backend's own config document and are edited through the proxied settings
 * route, addressed by the field specs here.
 */

/** Settings namespace owned by the host plugin. */
export const VOICESPIRIT_SETTINGS_NAMESPACE = 'voicespirit'

/** Realtime providers the backend accepts on the voice-chat WebSocket. */
export const VOICESPIRIT_PROVIDERS = [
  'DashScope', 'Google', 'OpenAI', 'Doubao', 'Cartesia', 'PersonaPlex', 'GLM4Voice',
] as const

export type VoiceSpiritProvider = typeof VOICESPIRIT_PROVIDERS[number]

/** Harness-side section (mirror of the host schema in dsh-host-voicespirit). */
export interface VoiceSpiritSettings {
  /** Absolute directory of the VoiceSpirit backend checkout (holds main.py). Empty auto-detects. */
  backendDir: string
  /** Python interpreter used to launch uvicorn. Empty auto-detects the checkout's venv. */
  pythonPath: string
  /** Loopback port the backend listens on. */
  port: number
  /** Launch the backend automatically when the harness web server starts. */
  autoStart: boolean
  /** VOICESPIRIT_DATA_DIR handed to the spawned backend; empty is harness-owned. */
  dataDir: string
  /** Provider selected in the voice UI before the user picks one. */
  defaultProvider: VoiceSpiritProvider
  /** Model selected in the voice UI; empty defers to the provider catalog. */
  defaultModel: string
  /** Voice selected in the voice UI; empty defers to the provider catalog. */
  defaultVoice: string
  /** Access token for an externally started, auth-enabled backend. */
  apiToken: string
}

/** One credential field a provider needs in the backend config document. */
export interface ProviderCredentialField {
  /** Dotted path inside the backend settings document (e.g. `api_keys.dashscope_api_key`). */
  path: string
  /** Locale key naming the field on the credentials form. */
  labelKey: string
  /** Placeholder hint (locale key) when the field is empty. */
  placeholderKey: string
  /** Render as a password input. */
  secret: boolean
}

/** One realtime provider as the UI presents it. */
export interface ProviderCatalogEntry {
  /** Provider id sent on the WebSocket handshake. */
  id: VoiceSpiritProvider
  /** Locale key of the display name. */
  labelKey: string
  /** Models offered when the backend has no fetched list. */
  models: string[]
  /** Voices offered when the backend has no fetched list. */
  voices: string[]
  /** Credential fields this provider reads from the backend config document. */
  credentials: ProviderCredentialField[]
  /** Locale key of the setup hint shown until the credentials are filled. */
  hintKey: string
}

const dashScopeCredentials: ProviderCredentialField[] = [
  {
    path: 'api_keys.dashscope_api_key',
    labelKey: 'credDashscopeKey',
    placeholderKey: 'credDashscopeKeyHint',
    secret: true,
  },
  {
    path: 'realtime_api_urls.DashScope',
    labelKey: 'credDashscopeRealtimeUrl',
    placeholderKey: 'credDashscopeRealtimeUrlHint',
    secret: false,
  },
]

const doubaoCredentials: ProviderCredentialField[] = [
  {
    // Realtime dialogue reads this dedicated token first; api_keys.doubao_api_key
    // remains a legacy fallback the backend honors on its own.
    path: 'doubao_access_token',
    labelKey: 'credDoubaoAccessToken',
    placeholderKey: 'credDoubaoAccessTokenHint',
    secret: true,
  },
  {
    path: 'doubao_app_id',
    labelKey: 'credDoubaoAppId',
    placeholderKey: 'credDoubaoAppIdHint',
    secret: false,
  },
]

const cartesiaCredentials: ProviderCredentialField[] = [
  {
    path: 'api_keys.cartesia_api_key',
    labelKey: 'credCartesiaKey',
    placeholderKey: 'credCartesiaKeyHint',
    secret: true,
  },
  {
    path: 'api_keys.deepseek_api_key',
    labelKey: 'credDeepseekKey',
    placeholderKey: 'credDeepseekKeyHint',
    secret: true,
  },
]

/** The provider catalog the switcher and the credentials form render. */
export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  {
    id: 'DashScope',
    labelKey: 'providerDashScope',
    models: [
      'qwen3.5-omni-plus-realtime',
      'qwen3.5-omni-flash-realtime',
      'qwen-audio-3.0-realtime-plus',
      'qwen-audio-3.0-realtime-flash',
      'qwen3.5-livetranslate-flash-realtime',
      'qwen3.5-livetranslate-plus-realtime',
    ],
    voices: ['Tina', 'Cherry', 'Ethan', 'Chelsie', 'Jada', 'Dylan', 'Sunshine', 'Serena'],
    credentials: dashScopeCredentials,
    hintKey: 'hintDashScope',
  },
  {
    id: 'Google',
    labelKey: 'providerGoogle',
    models: ['gemini-3.1-flash-live-preview'],
    voices: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'],
    credentials: [
      {
        path: 'api_keys.google_api_key',
        labelKey: 'credGoogleKey',
        placeholderKey: 'credGoogleKeyHint',
        secret: true,
      },
    ],
    hintKey: 'hintGoogle',
  },
  {
    id: 'OpenAI',
    labelKey: 'providerOpenAI',
    models: ['gpt-realtime-2', 'gpt-realtime', 'gpt-4o-realtime-preview'],
    voices: ['alloy', 'echo', 'shimmer', 'marin', 'cedar'],
    credentials: [
      {
        path: 'api_keys.openai_api_key',
        labelKey: 'credOpenAIKey',
        placeholderKey: 'credOpenAIKeyHint',
        secret: true,
      },
    ],
    hintKey: 'hintOpenAI',
  },
  {
    id: 'Doubao',
    labelKey: 'providerDoubao',
    models: ['doubao-realtime-dialogue'],
    voices: [
      'zh_female_vv_jupiter_bigtts',
      'zh_female_cancan_mars_bigtts',
      'zh_male_rouwanwan_mars_bigtts',
      'zh_female_rouse_jupiter_bigtts',
    ],
    credentials: doubaoCredentials,
    hintKey: 'hintDoubao',
  },
  {
    id: 'Cartesia',
    labelKey: 'providerCartesia',
    models: ['cartesia-realtime'],
    voices: ['f786b574-daa5-4673-aa0c-cbe3e8534c02'],
    credentials: cartesiaCredentials,
    hintKey: 'hintCartesia',
  },
  {
    id: 'PersonaPlex',
    labelKey: 'providerPersonaPlex',
    models: ['personaplex-local'],
    voices: ['NATF2.pt', 'NATF0.pt', 'NATF1.pt', 'VARM4.pt'],
    credentials: [],
    hintKey: 'hintPersonaPlex',
  },
  {
    id: 'GLM4Voice',
    labelKey: 'providerGLM4Voice',
    models: ['glm-4-voice-9b'],
    voices: ['default'],
    credentials: [],
    hintKey: 'hintGLM4Voice',
  },
]

/** Catalog entry for one provider id, or the DashScope default. */
export function providerEntry(provider: string | undefined): ProviderCatalogEntry {
  const fallback = PROVIDER_CATALOG.at(0)
  if (fallback === undefined) throw new Error('the provider catalog must not be empty')
  return PROVIDER_CATALOG.find(entry => entry.id === provider) ?? fallback
}

/** Lifecycle phase of the backend as the status route reports it. */
export type BackendPhase = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

/** Backend facts echoed by the status route. */
export interface BackendStatus {
  phase: BackendPhase
  managed: boolean
  pid: number | undefined
  port: number
  backendDir: string
  dataDir: string
  authEnabled: boolean | undefined
  version: string | undefined
  healthy: boolean
  error: string | undefined
  startedAt: string | undefined
}

/** Status-route payload. */
export interface VoiceSpiritStatusResponse {
  ok: boolean
  backend: BackendStatus
  settings: Omit<VoiceSpiritSettings, 'apiToken'>
}

/** Backend settings document (the proxied GET /api/settings face). */
export interface BackendSettingsDocument {
  config_path?: string
  providers?: string[]
  settings?: {
    api_keys?: Record<string, string>
    api_urls?: Record<string, string>
    realtime_api_urls?: Record<string, string>
    doubao_app_id?: string
    default_models?: Record<string, unknown>
    [key: string]: unknown
  }
}

/** Read a dotted path (`api_keys.dashscope_api_key`) from the backend document. */
export function readBackendPath(document: BackendSettingsDocument | undefined, path: string): string {
  if (document === undefined) return ''
  let cursor: unknown = document.settings ?? document
  for (const segment of path.split('.')) {
    if (typeof cursor !== 'object' || cursor === null) return ''
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return typeof cursor === 'string' ? cursor : ''
}

/** Read a boolean dotted path from the backend document; undefined when absent. */
export function readBackendFlag(document: BackendSettingsDocument | undefined, path: string): boolean | undefined {
  if (document === undefined) return undefined
  let cursor: unknown = document.settings ?? document
  for (const segment of path.split('.')) {
    if (typeof cursor !== 'object' || cursor === null) return undefined
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return typeof cursor === 'boolean' ? cursor : undefined
}

/** The `memory_settings` section of the backend document, as the card edits it. */
export interface MemorySettingsView {
  /** Master switch persisted as `memory_settings.enabled`. */
  enabled: boolean
  /** Suspend all cloud reads/writes for this run (`temporary_session`). */
  temporarySession: boolean
  /** Let realtime voice turns learn and recall (`remember_voice_chat`). */
  rememberVoiceChat: boolean
  /** EverMemOS endpoint, empty = backend default (`api.evermind.ai`). */
  apiUrl: string
  /** EverMemOS access key, empty until configured. */
  apiKey: string
  /** Cloud namespace partition; empty defers to the backend scope. */
  scopeId: string
}

/**
 * Extract the memory section from a backend settings document, applying the
 * backend defaults for anything absent (remember_voice_chat defaults on).
 */
export function readMemorySettingsView(document: BackendSettingsDocument | undefined): MemorySettingsView {
  const text = (path: string): string => readBackendPath(document, path).trim()
  return {
    enabled: readBackendFlag(document, 'memory_settings.enabled') === true,
    temporarySession: readBackendFlag(document, 'memory_settings.temporary_session') === true,
    rememberVoiceChat: readBackendFlag(document, 'memory_settings.remember_voice_chat') !== false,
    apiUrl: text('memory_settings.api_url'),
    apiKey: text('memory_settings.api_key'),
    scopeId: text('memory_settings.scope_id'),
  }
}

/** The `memory` payload the engine sends in the WS `config` message. */
export interface EvermemSessionConfig {
  enabled: true
  api_url: string
  api_key?: string
  scope_id?: string
  group_id?: string
}

export const DEFAULT_EVERMEM_URL = 'https://api.evermind.ai'

/**
 * Build the realtime session's memory payload from the stored settings.
 * @returns undefined when memory is off for voice calls (disabled, temporary
 * session, scene toggle off, or no API key) — the engine then sends no config.
 */
export function buildMemorySessionConfig(
  view: MemorySettingsView,
  groupId?: string,
): EvermemSessionConfig | undefined {
  if (!view.enabled || view.temporarySession || !view.rememberVoiceChat) return undefined
  const apiKey = view.apiKey.trim()
  if (apiKey === '') return undefined
  const scopeId = view.scopeId.trim()
  const group = groupId?.trim() ?? ''
  return {
    enabled: true,
    api_url: view.apiUrl.trim() || DEFAULT_EVERMEM_URL,
    api_key: apiKey,
    ...(scopeId === '' ? {} : { scope_id: scopeId }),
    ...(group === '' ? {} : { group_id: group }),
  }
}
