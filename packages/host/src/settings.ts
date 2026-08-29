/**
 * The VoiceSpirit settings namespace: the harness-side configuration the web
 * settings surface edits. These fields govern how the host launches and
 * reaches the VoiceSpirit realtime backend; provider credentials (API keys)
 * stay in the backend's own config document and travel through the proxied
 * settings routes, never through this namespace.
 */

import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Settings namespace owned by the VoiceSpirit host plugin. */
export const VOICESPIRIT_SETTINGS_NAMESPACE = 'voicespirit'

/** Branded namespace handle for the settings provider API. */
export const VOICESPIRIT_NAMESPACE = settingsNamespace(VOICESPIRIT_SETTINGS_NAMESPACE)

/** Realtime providers the backend's voice-chat WebSocket whitelist accepts. */
export const VOICESPIRIT_PROVIDERS = [
  'DashScope', 'Google', 'OpenAI', 'Doubao', 'Cartesia', 'PersonaPlex', 'GLM4Voice',
] as const

/** Provider the backend connects to when the caller names none. */
export const DEFAULT_PROVIDER = 'DashScope'

/** One realtime provider name from the backend whitelist. */
export type VoiceSpiritProvider = typeof VOICESPIRIT_PROVIDERS[number]

/** Harness-side configuration persisted under the `voicespirit` namespace. */
export interface VoiceSpiritSettings {
  /** Absolute directory of the VoiceSpirit backend checkout (holds main.py). Empty auto-detects. */
  backendDir: string
  /** Python interpreter used to launch uvicorn. Empty auto-detects the checkout's venv. */
  pythonPath: string
  /** Loopback port the backend listens on. */
  port: number
  /** Launch the backend automatically when the harness web server starts. */
  autoStart: boolean
  /**
   * VOICESPIRIT_DATA_DIR handed to the spawned backend (config.json and the
   * SQLite DB live there). Empty uses a harness-owned directory so the plugin
   * starts unauthenticated with its own credentials document.
   */
  dataDir: string
  /** Provider selected in the voice UI before the user picks one. */
  defaultProvider: VoiceSpiritProvider
  /** Model selected in the voice UI; empty defers to the provider catalog. */
  defaultModel: string
  /** Voice selected in the voice UI; empty defers to the provider catalog. */
  defaultVoice: string
  /**
   * VoiceSpirit access token for an externally started backend that has auth
   * enabled. A backend this plugin spawned itself authenticates with its own
   * injected token and never needs this field.
   */
  apiToken: string
  /** Enable AI voice agent realtime tools & function calling. */
  toolsEnabled?: boolean
  /** Enable realtime web search tool during duplex calls. */
  webSearchEnabled?: boolean
  /** Enable Python code sandbox execution tool during duplex calls. */
  pythonExecutorEnabled?: boolean
  /** Enable Tavus interactive video avatar. */
  tavusEnabled?: boolean
  /** Tavus PAL ID for video avatar. */
  tavusPalId?: string
}

/** Schema for the namespace; also the wire envelope configuration UIs render. */
export const VoiceSpiritSettingsSchema: z<VoiceSpiritSettings> = z.object({
  backendDir: z.string().default(''),
  pythonPath: z.string().default(''),
  port: z.natural().max(65535).default(8000),
  autoStart: z.boolean().default(true),
  dataDir: z.string().default(''),
  defaultProvider: z.union([...VOICESPIRIT_PROVIDERS]).default(DEFAULT_PROVIDER),
  defaultModel: z.string().default(''),
  defaultVoice: z.string().default(''),
  apiToken: z.string().default(''),
  toolsEnabled: z.boolean().default(true),
  webSearchEnabled: z.boolean().default(true),
  pythonExecutorEnabled: z.boolean().default(false),
  tavusEnabled: z.boolean().default(false),
  tavusPalId: z.string().default(''),
})

/** Resolved section when no settings provider is composed (mirrors the schema defaults). */
export const DEFAULT_VOICESPIRIT_SETTINGS: VoiceSpiritSettings = {
  backendDir: '',
  pythonPath: '',
  port: 8000,
  autoStart: true,
  dataDir: '',
  defaultProvider: DEFAULT_PROVIDER,
  defaultModel: '',
  defaultVoice: '',
  apiToken: '',
  toolsEnabled: true,
  webSearchEnabled: true,
  pythonExecutorEnabled: false,
  tavusEnabled: false,
  tavusPalId: '',
}

/** The subset of the section the status route echoes back to the browser. */
export type VoiceSpiritPublicSettings = Omit<VoiceSpiritSettings, 'apiToken'>

/** Strip secrets the status route must not echo. */
export function toPublicSettings(settings: VoiceSpiritSettings): VoiceSpiritPublicSettings {
  const { apiToken: _apiToken, ...publicPart } = settings
  return publicPart
}
