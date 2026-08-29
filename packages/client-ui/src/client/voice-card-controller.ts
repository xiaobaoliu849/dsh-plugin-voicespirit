/**
 * The settings card's form model: staged drafts over the harness settings
 * section plus the current provider's credential fields in the backend's own
 * config document, with the backend lifecycle commands and log tail beside
 * them. One save writes the harness section through the settings scope and the
 * credential drafts through the host proxy; nothing commits as it is typed.
 */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { VoiceSpiritBackend } from './backend.ts'
import {
  providerEntry,
  readBackendPath,
  readMemorySettingsView,
  PROVIDER_CATALOG,
  VOICESPIRIT_SETTINGS_NAMESPACE,
  type BackendSettingsDocument,
  type BackendStatus,
  type MemorySettingsView,
  type VoiceSpiritSettings,
} from './contract/settings.ts'

/** One staged text field as the card renders it. */
export interface CardTextField {
  /** Draft text. */
  text: string
  /** Whether the field carries a user-layer value in the harness section. */
  overridden: boolean
}

/** One credential control for the selected provider. */
export interface CredentialFieldView {
  /** Dotted path inside the backend document. */
  path: string
  /** Locale key of the label. */
  labelKey: string
  /** Locale key of the placeholder. */
  placeholderKey: string
  /** Render as a password input. */
  secret: boolean
  /** Draft text (empty = keep what is configured). */
  draft: string
  /** Whether the backend document currently holds a value. */
  configured: boolean
}

/** One EverMemOS text control for the memory section. */
export interface MemoryFieldView {
  /** Dotted path inside the backend document (`memory_settings.api_key`). */
  path: string
  /** Locale key of the label. */
  labelKey: string
  /** Locale key of the placeholder. */
  placeholderKey: string
  /** Render as a password input. */
  secret: boolean
  /** Draft text (empty = keep what is configured). */
  draft: string
  /** Whether the backend document currently holds a value. */
  configured: boolean
}

/** The memory section as the card renders it: staged overlays over the stored view. */
export interface MemorySectionView {
  stored: MemorySettingsView
  enabled: boolean
  temporarySession: boolean
  rememberVoiceChat: boolean
  apiUrlField: { draft: string, configured: boolean }
  apiKeyField: { draft: string, configured: boolean }
  scopeIdField: { draft: string, configured: boolean }
  /** True once the section has enough configuration to run (enabled + key). */
  ready: boolean
}

/** What the card renders. */
export interface VoiceSettingsCardState {
  /** False while the harness namespace is not served to this client. */
  available: boolean
  /** Whether the harness settings document accepts writes. */
  writable: boolean
  /** Whether any staged edit (harness or credential) awaits a save. */
  dirty: boolean
  /** Whether a save is in flight. */
  saving: boolean
  /** Whether the last save failed; cleared by the next edit or save. */
  failed: boolean
  /** Save result hint (locale key), cleared by the next edit or save. */
  savedKey: string | undefined

  backendDir: CardTextField
  pythonPath: CardTextField
  port: CardTextField
  dataDir: CardTextField
  apiToken: CardTextField
  /** Staged auto-start preference; undefined while the section is loading. */
  autoStart: boolean | undefined
  /** Staged provider/model/voice selections. */
  provider: string
  model: string
  voice: string
  /** Model options: catalog first, then anything fetched from the backend. */
  models: string[]

  backend: BackendStatus | undefined
  backendBusy: boolean
  backendError: string | undefined
  /** Whether the backend settings document has been read. */
  credentialsLoaded: boolean
  credentialFields: CredentialFieldView[]
  /** Whether any credential draft is staged. */
  credentialsDirty: boolean
  fetchingModels: boolean
  modelMessage: string | undefined
  log: string[] | undefined

  /** EverMemOS long-term memory section; fields load with the credentials. */
  memory: MemorySectionView | undefined

  /** AI Voice Agent Tools */
  toolsEnabled: boolean
  webSearchEnabled: boolean
  pythonExecutorEnabled: boolean

  /** Tavus Video Avatar */
  tavusEnabled: boolean
  tavusPalId: string
}

/** The registration-side face the card's slot entry injects. */
export interface VoiceSettingsCardFace {
  hooks: {
    /** Card snapshot bound by the renderer as useVoiceCard. */
    voiceCard: SnapshotStore<VoiceSettingsCardState>
  }
  /** The backend client instance */
  backendClient: VoiceSpiritBackend
  /** Stage draft text for one harness field. */
  edit: (field: CardTextFieldKey, text: string) => void
  /** Stage the auto-start preference. */
  setAutoStart: (value: boolean) => void
  /** Stage a provider switch (resets model/voice drafts to the catalog). */
  selectProvider: (provider: string) => void
  /** Stage a model. */
  selectModel: (model: string) => void
  /** Stage a voice. */
  selectVoice: (voice: string) => void
  /** Stage tool toggles */
  setToolToggle: (key: 'toolsEnabled' | 'webSearchEnabled' | 'pythonExecutorEnabled' | 'tavusEnabled', value: boolean) => void
  /** Stage Tavus Pal ID */
  setTavusPalId: (palId: string) => void
  /** Write every staged edit (harness section, then credentials and memory). */
  save: () => void
  /** Drop every staged edit. */
  discard: () => void
  /** Bring the backend up (or report why it cannot). */
  startBackend: () => void
  /** Stop the backend this harness spawned. */
  stopBackend: () => void
  /** Ask the backend to list the provider's models with the drafted key. */
  refreshModels: () => void
  /** Load (or reload) the backend settings document for the credential views. */
  loadCredentials: () => void
  /** Stage one credential draft. */
  editCredential: (path: string, text: string) => void
  /** Stage one EverMemOS field draft. */
  editMemoryField: (path: string, text: string) => void
  /** Stage one EverMemOS toggle. */
  setMemoryToggle: (key: 'enabled' | 'temporarySession' | 'rememberVoiceChat', value: boolean) => void
  /** Toggle the log tail view. */
  toggleLog: () => void
}

/** Harness text fields the card stages. */
export type CardTextFieldKey = 'backendDir' | 'pythonPath' | 'port' | 'dataDir' | 'apiToken'

const TEXT_FIELDS: readonly CardTextFieldKey[] = ['backendDir', 'pythonPath', 'port', 'dataDir', 'apiToken']

/** Backend-document paths the memory toggles write. */
const MEMORY_TOGGLE_PATHS = {
  enabled: 'memory_settings.enabled',
  temporarySession: 'memory_settings.temporary_session',
  rememberVoiceChat: 'memory_settings.remember_voice_chat',
} as const

export class VoiceSettingsCardController {
  private readonly store: SnapshotStore<VoiceSettingsCardState>
  private readonly staged = new Map<CardTextFieldKey, string>()
  private readonly credentialDrafts = new Map<string, string>()
  /** Staged EverMemOS edits: dotted paths hold strings, toggle keys booleans. */
  private readonly memoryStaged = new Map<string, string | boolean>()
  private stagedAutoStart: boolean | undefined
  private stagedProvider: string | undefined
  private stagedModel: string | undefined
  private stagedVoice: string | undefined
  private stagedToolsEnabled: boolean | undefined
  private stagedWebSearchEnabled: boolean | undefined
  private stagedPythonExecutorEnabled: boolean | undefined
  private stagedTavusEnabled: boolean | undefined
  private stagedTavusPalId: string | undefined
  private fetchedModels: string[] = []
  private backendDocument: BackendSettingsDocument | undefined
  private saving = false
  private failed = false
  private savedKey: string | undefined
  private fetchingModels = false
  private log: string[] | undefined
  private loadingLog = false

  constructor(
    private readonly settingsScope: import('@deepseek-ai/dsh-client-runtime/client').SettingsScope<VoiceSpiritSettings>,
    private readonly backendClient: VoiceSpiritBackend,
  ) {
    this.store = createSnapshotStore<VoiceSettingsCardState>(this.projection())
    this.settingsScope.subscribe(() => {
      // New section from the host: drop staged edits that now match, keep the rest.
      this.publish()
    })
    this.backendClient.subscribe(() => { this.publish() })
    void this.loadCredentials()
  }

  /** @returns the face the card's slot registration injects. */
  inject(): VoiceSettingsCardFace {
    return {
      hooks: { voiceCard: this.store },
      backendClient: this.backendClient,
      edit: (field, text) => {
        this.staged.set(field, text)
        this.clearResult()
        this.publish()
      },
      setAutoStart: (value) => {
        this.stagedAutoStart = value
        this.clearResult()
        this.publish()
      },
      selectProvider: (provider) => {
        this.stagedProvider = provider
        const entry = providerEntry(provider)
        this.stagedModel = entry.models[0] ?? ''
        this.stagedVoice = entry.voices[0] ?? ''
        this.clearResult()
        this.publish()
      },
      selectModel: (model) => {
        this.stagedModel = model
        this.clearResult()
        this.publish()
      },
      selectVoice: (voice) => {
        this.stagedVoice = voice
        this.clearResult()
        this.publish()
      },
      setToolToggle: (key, value) => {
        if (key === 'toolsEnabled') this.stagedToolsEnabled = value
        else if (key === 'webSearchEnabled') this.stagedWebSearchEnabled = value
        else if (key === 'pythonExecutorEnabled') this.stagedPythonExecutorEnabled = value
        else if (key === 'tavusEnabled') this.stagedTavusEnabled = value
        this.clearResult()
        this.publish()
      },
      setTavusPalId: (palId) => {
        this.stagedTavusPalId = palId
        this.clearResult()
        this.publish()
      },
      save: () => { void this.save() },
      discard: () => {
        this.staged.clear()
        this.credentialDrafts.clear()
        this.memoryStaged.clear()
        this.stagedAutoStart = undefined
        this.stagedProvider = undefined
        this.stagedModel = undefined
        this.stagedVoice = undefined
        this.stagedToolsEnabled = undefined
        this.stagedWebSearchEnabled = undefined
        this.stagedPythonExecutorEnabled = undefined
        this.stagedTavusEnabled = undefined
        this.stagedTavusPalId = undefined
        this.clearResult()
        this.publish()
      },
      startBackend: () => { void this.commandBackend('start') },
      stopBackend: () => { void this.commandBackend('stop') },
      refreshModels: () => { void this.refreshModels() },
      loadCredentials: () => { void this.loadCredentials() },
      editCredential: (path, text) => {
        if (text === '') this.credentialDrafts.delete(path)
        else this.credentialDrafts.set(path, text)
        this.clearResult()
        this.publish()
      },
      editMemoryField: (path, text) => {
        if (text.trim() === '' && !this.memoryStaged.has(path)) return
        if (text.trim() === '') this.memoryStaged.delete(path)
        else this.memoryStaged.set(path, text)
        this.clearResult()
        this.publish()
      },
      setMemoryToggle: (key, value) => {
        const path = MEMORY_TOGGLE_PATHS[key]
        // An edit equal to the stored view unstages itself.
        const stored = this.storedMemoryView()
        const current = key === 'enabled' ? stored.enabled
          : key === 'temporarySession' ? stored.temporarySession
          : stored.rememberVoiceChat
        if (value === current) this.memoryStaged.delete(path)
        else this.memoryStaged.set(path, value)
        this.clearResult()
        this.publish()
      },
      toggleLog: () => {
        this.log = this.log === undefined ? [] : undefined
        if (this.log !== undefined && !this.loadingLog) {
          this.loadingLog = true
          void this.backendClient.fetchLog(160).then((lines) => {
            this.log = lines
            this.loadingLog = false
            this.publish()
          })
        }
        this.publish()
      },
    }
  }

  /** Current staged-or-effective value of one harness text field. */
  private fieldValue(section: VoiceSpiritSettings | undefined, field: CardTextFieldKey): string {
    const staged = this.staged.get(field)
    if (staged !== undefined) return staged
    const value = section?.[field]
    return typeof value === 'string' ? value : String(value ?? '')
  }

  private fieldOverridden(field: CardTextFieldKey): boolean {
    const user = this.settingsScope.getSnapshot().user as Record<string, unknown> | undefined
    return user !== undefined && Object.hasOwn(user, field) && this.staged.get(field) === undefined
  }

  private effectiveProvider(section: VoiceSpiritSettings | undefined): string {
    return this.stagedProvider ?? section?.defaultProvider ?? 'DashScope'
  }

  private effectiveModel(section: VoiceSpiritSettings | undefined): string {
    return this.stagedModel ?? section?.defaultModel ?? providerEntry(this.effectiveProvider(section)).models[0] ?? ''
  }

  private effectiveVoice(section: VoiceSpiritSettings | undefined): string {
    return this.stagedVoice ?? section?.defaultVoice ?? providerEntry(this.effectiveProvider(section)).voices[0] ?? ''
  }

  /** The memory section as currently stored in the backend document. */
  private storedMemoryView(): MemorySettingsView {
    return readMemorySettingsView(this.backendDocument)
  }

  /** Memory section projection: stored view overlaid with staged edits. */
  private memoryProjection(): MemorySectionView {
    const stored = this.storedMemoryView()
    const stagedFlag = (key: keyof typeof MEMORY_TOGGLE_PATHS): boolean | undefined => {
      const staged = this.memoryStaged.get(MEMORY_TOGGLE_PATHS[key])
      return typeof staged === 'boolean' ? staged : undefined
    }
    const fieldDraft = (path: string): string => {
      const staged = this.memoryStaged.get(path)
      return typeof staged === 'string' ? staged : ''
    }
    const enabled = stagedFlag('enabled') ?? stored.enabled
    const temporarySession = stagedFlag('temporarySession') ?? stored.temporarySession
    const rememberVoiceChat = stagedFlag('rememberVoiceChat') ?? stored.rememberVoiceChat
    const apiKey = fieldDraft('memory_settings.api_key') || stored.apiKey
    return {
      stored,
      enabled,
      temporarySession,
      rememberVoiceChat,
      apiUrlField: { draft: fieldDraft('memory_settings.api_url'), configured: stored.apiUrl !== '' },
      apiKeyField: { draft: fieldDraft('memory_settings.api_key'), configured: stored.apiKey !== '' },
      scopeIdField: { draft: fieldDraft('memory_settings.scope_id'), configured: stored.scopeId !== '' },
      ready: enabled && !temporarySession && rememberVoiceChat && apiKey.trim() !== '',
    }
  }

  private projection(): VoiceSettingsCardState {
    const snapshot = this.settingsScope.getSnapshot()
    const section = snapshot.value
    const backendSnapshot = this.backendClient.getSnapshot()
    const provider = this.effectiveProvider(section)
    const entry = providerEntry(provider)
    const credentialFields: CredentialFieldView[] = entry.credentials.map((spec) => ({
      path: spec.path,
      labelKey: spec.labelKey,
      placeholderKey: spec.placeholderKey,
      secret: spec.secret,
      draft: this.credentialDrafts.get(spec.path) ?? '',
      configured: readBackendPath(this.backendDocument, spec.path) !== '',
    }))
    const portDraft = this.fieldValue(section, 'port')
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      dirty: this.staged.size > 0
        || this.credentialDrafts.size > 0
        || this.memoryStaged.size > 0
        || this.stagedAutoStart !== undefined
        || this.stagedProvider !== undefined
        || this.stagedModel !== undefined
        || this.stagedVoice !== undefined
        || this.stagedToolsEnabled !== undefined
        || this.stagedWebSearchEnabled !== undefined
        || this.stagedPythonExecutorEnabled !== undefined
        || this.stagedTavusEnabled !== undefined
        || this.stagedTavusPalId !== undefined,
      saving: this.saving,
      failed: this.failed,
      savedKey: this.savedKey,

      backendDir: {
        text: this.fieldValue(section, 'backendDir'),
        overridden: this.fieldOverridden('backendDir'),
      },
      pythonPath: {
        text: this.fieldValue(section, 'pythonPath'),
        overridden: this.fieldOverridden('pythonPath'),
      },
      port: {
        text: portDraft,
        overridden: this.fieldOverridden('port'),
      },
      dataDir: {
        text: this.fieldValue(section, 'dataDir'),
        overridden: this.fieldOverridden('dataDir'),
      },
      apiToken: {
        text: this.fieldValue(section, 'apiToken'),
        overridden: this.fieldOverridden('apiToken'),
      },
      autoStart: this.stagedAutoStart ?? section?.autoStart,
      provider,
      model: this.effectiveModel(section),
      voice: this.effectiveVoice(section),
      models: [...new Set([...entry.models, ...this.fetchedModels])],

      backend: backendSnapshot.backend,
      backendBusy: backendSnapshot.commanding,
      backendError: backendSnapshot.error,
      credentialsLoaded: this.backendDocument !== undefined,
      credentialFields,
      credentialsDirty: this.credentialDrafts.size > 0,
      fetchingModels: this.fetchingModels,
      modelMessage: undefined,
      log: this.log,
      memory: this.memoryProjection(),

      toolsEnabled: this.stagedToolsEnabled ?? section?.toolsEnabled ?? true,
      webSearchEnabled: this.stagedWebSearchEnabled ?? section?.webSearchEnabled ?? true,
      pythonExecutorEnabled: this.stagedPythonExecutorEnabled ?? section?.pythonExecutorEnabled ?? false,
      tavusEnabled: this.stagedTavusEnabled ?? section?.tavusEnabled ?? false,
      tavusPalId: this.stagedTavusPalId ?? section?.tavusPalId ?? '',
    }
  }

  private async save(): Promise<void> {
    if (this.saving) return
    this.saving = true
    this.failed = false
    this.savedKey = undefined
    this.publish()
    let ok = true
    try {
      const patch: Record<string, unknown> = {}
      for (const field of TEXT_FIELDS) {
        const staged = this.staged.get(field)
        if (staged === undefined) continue
        const trimmed = staged.trim()
        if (field === 'port') {
          const port = Number(trimmed)
          if (!Number.isFinite(port) || port <= 0 || port > 65535) {
            this.failed = true
            ok = false
            continue
          }
          patch[field] = port
          continue
        }
        patch[field] = trimmed
      }
      if (this.stagedAutoStart !== undefined) patch.autoStart = this.stagedAutoStart
      if (this.stagedProvider !== undefined) patch.defaultProvider = this.stagedProvider
      if (this.stagedModel !== undefined) patch.defaultModel = this.stagedModel
      if (this.stagedVoice !== undefined) patch.defaultVoice = this.stagedVoice
      if (this.stagedToolsEnabled !== undefined) patch.toolsEnabled = this.stagedToolsEnabled
      if (this.stagedWebSearchEnabled !== undefined) patch.webSearchEnabled = this.stagedWebSearchEnabled
      if (this.stagedPythonExecutorEnabled !== undefined) patch.pythonExecutorEnabled = this.stagedPythonExecutorEnabled
      if (this.stagedTavusEnabled !== undefined) patch.tavusEnabled = this.stagedTavusEnabled
      if (this.stagedTavusPalId !== undefined) patch.tavusPalId = this.stagedTavusPalId
      if (Object.keys(patch).length > 0) {
        for (const [field, value] of Object.entries(patch)) {
          await this.settingsScope.set(field, value)
        }
        const user = this.settingsScope.getSnapshot().user as Record<string, unknown> | undefined
        for (const field of Object.keys(patch)) {
          if (user === undefined || user[field] !== patch[field]) ok = false
        }
      }

      // Credential and memory drafts ride the backend document, not the
      // harness section; both merge into one deep-merge PATCH per save.
      if (this.credentialDrafts.size > 0 || this.memoryStaged.size > 0) {
        const backendPatch: Record<string, unknown> = {}
        const writePath = (path: string, value: string | boolean): void => {
          const segments = path.split('.')
          let cursor = backendPatch
          for (const segment of segments.slice(0, -1)) {
            if (typeof cursor[segment] !== 'object' || cursor[segment] === null) cursor[segment] = {}
            cursor = cursor[segment] as Record<string, unknown>
          }
          const leaf = segments.at(-1)
          if (leaf !== undefined) cursor[leaf] = value
        }
        for (const [path, value] of this.credentialDrafts) {
          const trimmed = value.trim()
          if (trimmed === '') continue
          writePath(path, trimmed)
        }
        for (const [key, value] of this.memoryStaged) {
          if (typeof value === 'boolean') { writePath(key, value); continue }
          const trimmed = value.trim()
          if (trimmed !== '') writePath(key, trimmed)
        }
        if (Object.keys(backendPatch).length > 0) {
          const error = await this.backendClient.saveSettings(backendPatch)
          if (error !== undefined) {
            this.failed = true
            ok = false
          } else {
            await this.loadCredentials()
          }
        }
      }

      for (const field of Object.keys(patch)) this.staged.delete(field as CardTextFieldKey)
      this.credentialDrafts.clear()
      this.memoryStaged.clear()
      this.stagedAutoStart = undefined
      this.stagedProvider = undefined
      this.stagedModel = undefined
      this.stagedVoice = undefined
      if (ok && !this.failed) this.savedKey = 'saved'
    } finally {
      this.saving = false
      this.publish()
    }
  }

  private async commandBackend(action: 'start' | 'stop'): Promise<void> {
    if (action === 'start') await this.backendClient.start()
    else await this.backendClient.stop()
    this.publish()
  }

  private async refreshModels(): Promise<void> {
    if (this.fetchingModels) return
    this.fetchingModels = true
    this.publish()
    try {
      const section = this.settingsScope.getSnapshot().value
      const provider = this.effectiveProvider(section)
      const entry = providerEntry(provider)
      const keyField = entry.credentials.find(spec => spec.secret)
      const urlField = entry.credentials.find(spec => !spec.secret)
      const apiKey = (this.credentialDrafts.get(keyField?.path ?? '')
        ?? readBackendPath(this.backendDocument, keyField?.path ?? ''))
        || undefined
      const baseUrl = (this.credentialDrafts.get(urlField?.path ?? '')
        ?? readBackendPath(this.backendDocument, urlField?.path ?? ''))
        || undefined
      const result = await this.backendClient.fetchModels(provider, apiKey, baseUrl)
      if (result.ok) {
        this.fetchedModels = result.models
        if (result.models.length > 0) this.stagedModel = result.models[0]
        this.savedKey = 'modelsRefreshed'
      } else {
        this.failed = true
        this.savedKey = 'modelsRefreshFailed'
      }
    } finally {
      this.fetchingModels = false
      this.publish()
    }
  }

  private async loadCredentials(): Promise<void> {
    const document = await this.backendClient.fetchSettings()
    if (document !== undefined) {
      this.backendDocument = document
      this.publish()
    }
  }

  private clearResult(): void {
    this.failed = false
    this.savedKey = undefined
  }

  private publish(): void {
    this.store.set(this.projection())
  }
}

/** The settings namespace this card is keyed under. */
export { VOICESPIRIT_SETTINGS_NAMESPACE, PROVIDER_CATALOG }
