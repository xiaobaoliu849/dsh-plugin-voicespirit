/**
 * The VoiceSpirit card in Settings → Plugins: backend lifecycle and paths, the
 * provider/model/voice selection, and the selected provider's credential
 * fields in the backend's own config document. One save writes both layers.
 */

import { useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { PROVIDER_CATALOG } from '../contract/settings.ts'
import type { VoiceSpiritKey } from '../locales.ts'
import type { VoiceSettingsCardFace } from '../voice-card-controller.ts'
import type {} from '../card-slot-contract.ts'
import styles from './VoiceSettingsCard.module.css'

/** Props the renderer binds for the VoiceSpirit card. */
export type VoiceSettingsCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'voicespirit'>
  & InjectFace<VoiceSettingsCardFace>

/**
 * Render the VoiceSpirit plugin card.
 * @param props - locale copy, the card snapshot, and its actions.
 * @returns the card, or nothing while the namespace is unserved.
 */
export function VoiceSettingsCard(props: VoiceSettingsCardProps) {
  const { t } = props
  const state = props.useVoiceCard(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  if (!state.available) return null

  const phaseLabel = state.backend === undefined
    ? t('backendStopped')
    : state.backend.phase === 'running' && state.backend.healthy
    ? t('backendRunning')
    : state.backend.phase === 'starting'
    ? t('backendStarting')
    : state.backend.phase === 'stopping'
    ? t('backendStopping')
    : state.backend.phase === 'error'
    ? t('backendError')
    : t('backendStopped')

  const phaseClass = state.backend !== undefined
    && state.backend.phase === 'running'
    && state.backend.healthy
    ? styles.dotRunning
    : state.backend?.phase === 'starting' || state.backend?.phase === 'stopping'
    ? styles.dotStarting
    : state.backend?.phase === 'error'
    ? styles.dotError
    : styles.dotStopped

  const blocked = !state.dirty || state.saving

  return (
    <li className={`${styles.card} ${open ? styles.cardOpen : ''}`}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={open}
        onClick={() => { setOpen(!open) }}
      >
        <span className={styles.headText}>
          <span className={styles.title}>{t('cardTitle')}</span>
          <span className={styles.description}>{t('cardDescription')}</span>
        </span>
        {state.dirty && <span className={styles.dirtyBadge}>●</span>}
        <span className={`${styles.headerDot} ${phaseClass}`} title={phaseLabel} />
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className={styles.body}>
          {/* ── Backend ─────────────────────────────────────────────── */}
          <h4 className={styles.sectionTitle}>{t('sectionBackend')}</h4>
          <div className={styles.backendRow}>
            <span className={`${styles.headerDot} ${phaseClass}`} />
            <span className={styles.backendPhase}>{phaseLabel}</span>
            <span className={styles.backendMeta}>
              {state.backend?.managed ? t('backendManaged') : t('backendExternal')}
              {state.backend?.port !== undefined ? ` · :${String(state.backend.port)}` : ''}
            </span>
            <span className={styles.backendActions}>
              <button
                type="button"
                className={styles.miniBtn}
                disabled={state.backendBusy}
                onClick={props.startBackend}
              >
                {t('backendStart')}
              </button>
              <button
                type="button"
                className={styles.miniBtn}
                disabled={state.backendBusy || state.backend?.managed === false}
                onClick={props.stopBackend}
              >
                {t('backendStop')}
              </button>
              <button type="button" className={styles.miniBtn} onClick={props.toggleLog}>
                {t('backendLog')}
              </button>
            </span>
          </div>
          {state.backend?.error && (
            <p className={styles.errorLine}>{state.backend.error}</p>
          )}
          {state.log !== undefined && (
            <pre className={styles.log}>
              {state.log.length > 0 ? state.log.join('\n') : t('logEmpty')}
            </pre>
          )}

          <TextField
            id="voicespirit-backend-dir"
            label={t('backendDir')}
            hint={t('backendDirHint')}
            overriddenLabel={t('overridden')}
            field={state.backendDir}
            disabled={!state.writable}
            onEdit={(text) => { props.edit('backendDir', text) }}
          />
          <TextField
            id="voicespirit-python"
            label={t('pythonPath')}
            hint={t('pythonPathHint')}
            overriddenLabel={t('overridden')}
            field={state.pythonPath}
            disabled={!state.writable}
            onEdit={(text) => { props.edit('pythonPath', text) }}
          />
          <div className={styles.fieldRow}>
            <TextField
              id="voicespirit-port"
              label={t('port')}
              field={state.port}
              disabled={!state.writable}
              onEdit={(text) => { props.edit('port', text) }}
            />
            <div className={styles.toggleField}>
              <span className={styles.fieldLabel}>{t('autoStart')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={state.autoStart === true}
                disabled={!state.writable}
                className={`${styles.switch} ${state.autoStart ? styles.switchOn : ''}`}
                onClick={() => { props.setAutoStart(!(state.autoStart === true)) }}
              >
                <span className={styles.switchKnob} />
              </button>
              <span className={styles.toggleValue}>
                {state.autoStart ? t('autoStartOn') : t('autoStartOff')}
              </span>
            </div>
          </div>
          <TextField
            id="voicespirit-data-dir"
            label={t('dataDir')}
            hint={t('dataDirHint')}
            overriddenLabel={t('overridden')}
            field={state.dataDir}
            disabled={!state.writable}
            onEdit={(text) => { props.edit('dataDir', text) }}
          />
          <TextField
            id="voicespirit-token"
            label={t('apiToken')}
            hint={t('apiTokenHint')}
            overriddenLabel={t('overridden')}
            field={state.apiToken}
            secret
            disabled={!state.writable}
            onEdit={(text) => { props.edit('apiToken', text) }}
          />

          {/* ── Provider ────────────────────────────────────────────── */}
          <h4 className={styles.sectionTitle}>{t('sectionProvider')}</h4>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('defaultProvider')}</span>
              <select
                className={styles.select}
                value={state.provider}
                disabled={!state.writable}
                onChange={(e) => { props.selectProvider(e.target.value) }}
              >
                {PROVIDER_CATALOG.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {t(entry.labelKey as VoiceSpiritKey)}
                  </option>
                ))}
              </select>
              <span className={styles.fieldHint}>{t(state.provider === '' ? 'hintDashScope' : (PROVIDER_CATALOG.find(e => e.id === state.provider)?.hintKey ?? 'hintDashScope') as VoiceSpiritKey)}</span>
            </label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('defaultModel')}</span>
              <div className={styles.selectRow}>
                <select
                  className={styles.select}
                  value={state.model}
                  disabled={!state.writable}
                  onChange={(e) => { props.selectModel(e.target.value) }}
                >
                  {state.models.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                  {!state.models.includes(state.model) && state.model !== '' && (
                    <option value={state.model}>{state.model}</option>
                  )}
                </select>
                <button
                  type="button"
                  className={styles.miniBtn}
                  disabled={state.fetchingModels}
                  onClick={props.refreshModels}
                >
                  {state.fetchingModels ? t('refreshingModels') : t('refreshModels')}
                </button>
              </div>
            </label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('defaultVoice')}</span>
              <select
                className={styles.select}
                value={state.voice}
                disabled={!state.writable}
                onChange={(e) => { props.selectVoice(e.target.value) }}
              >
                {(PROVIDER_CATALOG.find(e => e.id === state.provider)?.voices ?? []).map((voice) => (
                  <option key={voice} value={voice}>{voice}</option>
                ))}
                {!PROVIDER_CATALOG.find(e => e.id === state.provider)?.voices.includes(state.voice)
                  && state.voice !== ''
                  && <option value={state.voice}>{state.voice}</option>}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('customVoice')}</span>
              <input
                id="voicespirit-custom-voice"
                type="text"
                className={styles.input}
                value={state.voice}
                autoComplete="off"
                spellCheck={false}
                disabled={!state.writable}
                onChange={(e) => { props.selectVoice(e.target.value) }}
              />
              <span className={styles.fieldHint}>{t('customVoiceHint')}</span>
            </label>
          </div>

          {/* ── Credentials ─────────────────────────────────────────── */}
          <h4 className={styles.sectionTitle}>{t('sectionCredentials')}</h4>
          {!state.credentialsLoaded && (
            <p className={styles.fieldHint}>{t('errUnreachable')}</p>
          )}
          {state.credentialFields.map((field) => (
            <TextField
              key={field.path}
              id={`voicespirit-cred-${field.path}`}
              label={t(field.labelKey as VoiceSpiritKey) + (field.configured ? ' ✓' : '')}
              hint={field.secret ? '' : t(field.placeholderKey as VoiceSpiritKey)}
              placeholder={field.secret ? t(field.placeholderKey as VoiceSpiritKey) : ''}
              field={{ text: field.draft, overridden: field.configured }}
              secret={field.secret}
              disabled={!state.credentialsLoaded}
              onEdit={(text) => { props.editCredential(field.path, text) }}
            />
          ))}

          {/* ── Memory · EverMemOS ───────────────────────────────────── */}
          {state.memory !== undefined && (
            <>
              <h4 className={styles.sectionTitle}>
                {t('sectionMemory')}
                <span
                  className={`${styles.headerDot} ${state.memory.ready ? styles.dotRunning : styles.dotStopped}`}
                  title={state.memory.ready ? t('memoryReady') : t('memoryInactive')}
                />
              </h4>
              <div className={styles.fieldRow}>
                <ToggleField
                  label={t('memoryEnable')}
                  hint={t('memoryEnableHint')}
                  value={state.memory.enabled}
                  disabled={!state.writable || !state.credentialsLoaded}
                  onChange={(value) => { props.setMemoryToggle('enabled', value) }}
                />
              </div>
              {state.memory.enabled && (
                <>
                  <div className={styles.fieldRow}>
                    <ToggleField
                      label={t('memoryTempSession')}
                      hint={t('memoryTempSessionHint')}
                      value={state.memory.temporarySession}
                      disabled={!state.writable || !state.credentialsLoaded}
                      onChange={(value) => { props.setMemoryToggle('temporarySession', value) }}
                    />
                    <ToggleField
                      label={t('memorySceneVoice')}
                      hint={t('memorySceneVoiceHint')}
                      value={state.memory.rememberVoiceChat}
                      disabled={!state.writable || !state.credentialsLoaded}
                      onChange={(value) => { props.setMemoryToggle('rememberVoiceChat', value) }}
                    />
                  </div>
                  <TextField
                    id="voicespirit-memory-url"
                    label={t('memoryApiUrl')}
                    hint={t(state.memory.apiUrlField.configured ? 'memoryApiUrlHint' : 'memoryApiUrlDefault')}
                    placeholder={t('memoryApiUrlHint')}
                    field={{ text: state.memory.apiUrlField.draft, overridden: state.memory.apiUrlField.configured }}
                    disabled={!state.credentialsLoaded}
                    onEdit={(text) => { props.editMemoryField('memory_settings.api_url', text) }}
                  />
                  <TextField
                    id="voicespirit-memory-key"
                    label={t('memoryApiKey') + (state.memory.apiKeyField.configured ? ' ✓' : '')}
                    placeholder={t('memoryApiKeyHint')}
                    field={{ text: state.memory.apiKeyField.draft, overridden: state.memory.apiKeyField.configured }}
                    secret
                    disabled={!state.credentialsLoaded}
                    onEdit={(text) => { props.editMemoryField('memory_settings.api_key', text) }}
                  />
                  <TextField
                    id="voicespirit-memory-scope"
                    label={t('memoryScopeId')}
                    hint={t('memoryScopeIdHint')}
                    placeholder={t('memoryScopeIdHint')}
                    field={{ text: state.memory.scopeIdField.draft, overridden: state.memory.scopeIdField.configured }}
                    disabled={!state.credentialsLoaded}
                    onEdit={(text) => { props.editMemoryField('memory_settings.scope_id', text) }}
                  />
                </>
              )}
            </>
          )}

          {/* ── Footer ──────────────────────────────────────────────── */}
          <div className={styles.footer}>
            <span className={
              state.failed ? styles.footerError : state.savedKey !== undefined ? styles.footerOk : styles.footerHint
            }>
              {state.failed
                ? t('saveFailed')
                : state.savedKey !== undefined
                ? t(state.savedKey as VoiceSpiritKey)
                : state.saving
                ? t('saving')
                : ''}
            </span>
            <button
              type="button"
              className={styles.ghostBtn}
              disabled={!state.dirty || state.saving}
              onClick={props.discard}
            >
              {t('discard')}
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={blocked}
              onClick={props.save}
            >
              {state.saving ? t('saving') : t('save')}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

/** One staged text field with its label, hint, and override badge. */
function TextField(props: {
  id: string
  label: string
  hint?: string
  placeholder?: string
  overriddenLabel?: string
  field: { text: string, overridden: boolean }
  secret?: boolean
  disabled?: boolean
  onEdit: (text: string) => void
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>
        {props.label}
        {props.field.overridden && props.overriddenLabel !== undefined && (
          <span className={styles.overrideBadge}>{props.overriddenLabel}</span>
        )}
      </span>
      <input
        id={props.id}
        type={props.secret ? 'password' : 'text'}
        className={styles.input}
        value={props.field.text}
        placeholder={props.placeholder}
        autoComplete="off"
        spellCheck={false}
        disabled={props.disabled}
        onChange={(e) => { props.onEdit(e.target.value) }}
      />
      {props.hint !== undefined && props.hint !== '' && (
        <span className={styles.fieldHint}>{props.hint}</span>
      )}
    </label>
  )
}

/** One staged boolean preference rendered as the shared switch control. */
function ToggleField(props: {
  label: string
  hint?: string
  value: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className={`${styles.toggleField} ${styles.field}`}>
      <span className={styles.fieldLabel}>{props.label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={props.value}
        disabled={props.disabled}
        className={`${styles.switch} ${props.value ? styles.switchOn : ''}`}
        onClick={() => { props.onChange(!props.value) }}
      >
        <span className={styles.switchKnob} />
      </button>
      {props.hint !== undefined && props.hint !== '' && (
        <span className={styles.fieldHint}>{props.hint}</span>
      )}
    </div>
  )
}
