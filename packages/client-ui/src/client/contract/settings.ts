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
  /** Active voice interaction mode: dialogue (regular chat) or translate (live simultaneous interpreter). */
  activeVoiceMode?: 'dialogue' | 'translate'
  /** Translation mode: bidirectional (two-way) or unidirectional. */
  translationMode?: 'bidirectional' | 'unidirectional'
  /** Source language code for LiveTranslate. */
  sourceLanguage?: string
  /** Target language code for LiveTranslate. */
  targetLanguage?: string
  /** Whether the AI speaks the translated text out loud via TTS. */
  echoTargetLanguage?: boolean
}

export interface TranslateLanguage {
  value: string
  label: string
  labelZh: string
  flag: string
}

export const LIVE_TRANSLATE_TARGET_LANGUAGES: readonly TranslateLanguage[] = [
  { value: 'zh-Hans', label: 'Chinese (Simplified)', labelZh: '中文 (简体)', flag: '🇨🇳' },
  { value: 'zh-Hant', label: 'Chinese (Traditional)', labelZh: '中文 (繁体)', flag: '🇭🇰' },
  { value: 'en', label: 'English', labelZh: '英语', flag: '🇺🇸' },
  { value: 'ja', label: 'Japanese', labelZh: '日语', flag: '🇯🇵' },
  { value: 'ko', label: 'Korean', labelZh: '韩语', flag: '🇰🇷' },
  { value: 'fr', label: 'French', labelZh: '法语', flag: '🇫🇷' },
  { value: 'de', label: 'German', labelZh: '德语', flag: '🇩🇪' },
  { value: 'es', label: 'Spanish', labelZh: '西班牙语', flag: '🇪🇸' },
  { value: 'ru', label: 'Russian', labelZh: '俄语', flag: '🇷🇺' },
  { value: 'it', label: 'Italian', labelZh: '意大利语', flag: '🇮🇹' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)', labelZh: '葡萄牙语', flag: '🇧🇷' },
  { value: 'ar', label: 'Arabic', labelZh: '阿拉伯语', flag: '🇸🇦' },
  { value: 'th', label: 'Thai', labelZh: '泰语', flag: '🇹🇭' },
  { value: 'vi', label: 'Vietnamese', labelZh: '越南语', flag: '🇻🇳' },
  { value: 'id', label: 'Indonesian', labelZh: '印尼语', flag: '🇮🇩' },
]

export function isLiveTranslateModel(provider: string, model: string): boolean {
  const normP = (provider || '').toLowerCase()
  const normM = (model || '').toLowerCase()
  if (normP.includes('dashscope') && normM.includes('livetranslate')) return true
  if (normP.includes('google') && (normM.includes('translate') || normM.includes('live-translate'))) return true
  return false
}

export function getLanguageDisplayBadge(code: string): string {
  if (!code) return ''
  if (code.startsWith('zh')) return '🇨🇳 中'
  if (code === 'en') return '🇺🇸 英'
  if (code === 'ja') return '🇯🇵 日'
  if (code === 'ko') return '🇰🇷 韩'
  if (code === 'fr') return '🇫🇷 法'
  if (code === 'de') return '🇩🇪 德'
  if (code === 'es') return '🇪🇸 西'
  if (code === 'ru') return '🇷🇺 俄'
  if (code === 'it') return '🇮🇹 意'
  if (code.startsWith('pt')) return '🇧🇷 葡'
  if (code === 'ar') return '🇸🇦 阿'
  if (code === 'th') return '🇹🇭 泰'
  if (code === 'vi') return '🇻🇳 越'
  if (code === 'id') return '🇮🇩 印'
  const item = LIVE_TRANSLATE_TARGET_LANGUAGES.find(l => l.value === code)
  return item ? `${item.flag} ${item.labelZh.slice(0, 2)}` : code.toUpperCase()
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
    // Realtime dialogue uses API Key from new console (X-Api-Key header).
    // Stored in api_keys.doubao_access_token or doubao_api_key.
    path: 'api_keys.doubao_access_token',
    labelKey: 'credDoubaoAccessToken',
    placeholderKey: 'credDoubaoAccessTokenHint',
    secret: true,
  },
  {
    path: 'realtime_api_urls.Doubao',
    labelKey: 'credDoubaoRealtimeUrl',
    placeholderKey: 'credDoubaoRealtimeUrlHint',
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
    models: ['gemini-3.1-flash-live-preview', 'gemini-3.5-live-translate-preview'],
    voices: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Zephyr', 'Lyra', 'Leda', 'Achird', 'Autonoe'],
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
    models: ['doubao-realtime', 'doubao-realtime-dialogue'],
    voices: [
      'zh_female_vv_jupiter_bigtts',
      'zh_female_xiaohe_jupiter_bigtts',
      'zh_male_yunzhou_jupiter_bigtts',
      'zh_male_xiaotian_jupiter_bigtts',
      'en_male_tim_uranus_bigtts',
      'en_female_dacey_uranus_bigtts',
      'en_female_stokie_uranus_bigtts',
    ],
    credentials: doubaoCredentials,
    hintKey: 'hintDoubao',
  },
  {
    id: 'Cartesia',
    labelKey: 'providerCartesia',
    models: ['cartesia-realtime', 'sonic-preview', 'sonic-3.5', 'sonic-3'],
    voices: [
      'f786b574-daa5-4673-aa0c-cbe3e8534c02',
      'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4',
      'a5136bf9-224c-4d76-b823-52bd5efcffcc',
      '62ae83ad-4f6a-430b-af41-a9bede9286ca',
      'ef191366-f52f-447a-a398-ed8c0f2943a1',
    ],
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
    if (typeof cursor !== 'object' || cursor === null) {
      cursor = undefined
      break
    }
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  if (typeof cursor === 'string' && cursor.trim() !== '') return cursor

  // Fallback checks for Doubao and common keys
  const root = document as Record<string, unknown>
  const settings = ((document.settings ?? {}) as Record<string, unknown>)
  const apiKeys = ((settings.api_keys ?? {}) as Record<string, unknown>)

  if (path === 'api_keys.doubao_access_token' || path === 'doubao_access_token') {
    if (typeof apiKeys.doubao_access_token === 'string' && apiKeys.doubao_access_token) return apiKeys.doubao_access_token
    if (typeof settings.doubao_access_token === 'string' && settings.doubao_access_token) return settings.doubao_access_token
    if (typeof root.doubao_access_token === 'string' && root.doubao_access_token) return root.doubao_access_token
    if (typeof apiKeys.doubao_api_key === 'string' && apiKeys.doubao_api_key) return apiKeys.doubao_api_key
    if (typeof settings.doubao_api_key === 'string' && settings.doubao_api_key) return settings.doubao_api_key
  }
  if (path === 'api_keys.doubao_app_id' || path === 'doubao_app_id') {
    if (typeof apiKeys.doubao_app_id === 'string' && apiKeys.doubao_app_id) return apiKeys.doubao_app_id
    if (typeof settings.doubao_app_id === 'string' && settings.doubao_app_id) return settings.doubao_app_id
    if (typeof root.doubao_app_id === 'string' && root.doubao_app_id) return root.doubao_app_id
  }
  if (path === 'realtime_api_urls.Doubao' || path === 'realtime_api_urls_doubao') {
    const urls = ((settings.realtime_api_urls ?? root.realtime_api_urls ?? {}) as Record<string, unknown>)
    if (typeof urls.Doubao === 'string' && urls.Doubao) return urls.Doubao
    if (typeof urls.doubao === 'string' && urls.doubao) return urls.doubao
  }
  if (path === 'api_keys.dashscope_api_key' || path === 'dashscope_api_key') {
    if (typeof apiKeys.dashscope_api_key === 'string' && apiKeys.dashscope_api_key) return apiKeys.dashscope_api_key
    if (typeof settings.dashscope_api_key === 'string' && settings.dashscope_api_key) return settings.dashscope_api_key
    if (typeof root.dashscope_api_key === 'string' && root.dashscope_api_key) return root.dashscope_api_key
  }
  return ''
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
