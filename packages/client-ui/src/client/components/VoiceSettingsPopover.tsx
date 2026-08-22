/**
 * The call dock's quick settings popover: provider/model/voice switch over the
 * harness settings scope, the selected provider's credential fields written
 * straight into the backend config document, and the backend phase with a
 * one-click start. Full configuration (backend paths) lives in the settings
 * card.
 */

import React, { useState } from 'react'
import type { VoiceSpiritController, VoiceSpiritUiState } from '../voice-controller.ts'
import {
  PROVIDER_CATALOG,
  providerEntry,
  readBackendPath,
  type BackendSettingsDocument,
} from '../contract/settings.ts'
import type { VoiceSpiritKey } from '../locales.ts'
import { VoiceSelector } from './VoiceSelector.tsx'
import styles from './VoiceCall.module.css'

export interface VoiceSettingsPopoverProps {
  snapshot: VoiceSpiritUiState
  controller: VoiceSpiritController
  t: (key: VoiceSpiritKey) => string
}

export const VoiceSettingsPopover: React.FC<VoiceSettingsPopoverProps> = ({
  snapshot,
  controller,
  t,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [document, setDocument] = useState<BackendSettingsDocument | undefined>(undefined)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingKeys, setSavingKeys] = useState(false)
  const [keysResult, setKeysResult] = useState<'saved' | 'failed' | undefined>(undefined)

  const provider = snapshot.engine.provider || 'DashScope'
  const entry = providerEntry(provider)
  const backendPhase = snapshot.backend.backend?.phase ?? 'stopped'
  const backendHealthy = snapshot.backend.backend?.healthy ?? false

  const toggleOpen = (): void => {
    const next = !isOpen
    setIsOpen(next)
    if (next) {
      // Fresh read each open so ✓ markers track what the backend holds now.
      setKeysResult(undefined)
      void controller.getBackendClient().fetchSettings().then((loaded) => { setDocument(loaded) })
    }
  }

  const applySelection = async (patch: { provider?: string, model?: string, voice?: string }): Promise<void> => {
    setSaving(true)
    try {
      await controller.setVoiceSelection(patch)
    } finally {
      setSaving(false)
    }
  }

  /** Write every non-empty draft into the backend document as a deep patch. */
  const saveKeys = async (): Promise<void> => {
    const patch: Record<string, unknown> = {}
    for (const spec of entry.credentials) {
      const value = drafts[spec.path]?.trim()
      if (value === undefined || value === '') continue
      const segments = spec.path.split('.')
      let cursor = patch
      for (const segment of segments.slice(0, -1)) {
        if (typeof cursor[segment] !== 'object' || cursor[segment] === null) cursor[segment] = {}
        cursor = cursor[segment] as Record<string, unknown>
      }
      const leaf = segments.at(-1)
      if (leaf !== undefined) cursor[leaf] = value
    }
    if (Object.keys(patch).length === 0) return
    setSavingKeys(true)
    try {
      const error = await controller.getBackendClient().saveSettings(patch)
      if (error === undefined) {
        setDrafts({})
        setKeysResult('saved')
        void controller.getBackendClient().fetchSettings().then((loaded) => { setDocument(loaded) })
      } else {
        setKeysResult('failed')
      }
    } finally {
      setSavingKeys(false)
    }
  }

  return (
    <div className={styles.popoverAnchor}>
      <button
        type="button"
        className={styles.actionBtn}
        onClick={toggleOpen}
        title={t('settingsTitle')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className={styles.popoverScrim} onClick={toggleOpen} />
          <div className={styles.popoverPanel}>
            <div className={styles.popoverHeader}>
              <span className={styles.popoverTitle}>{t('settingsTitle')}</span>
              <button
                type="button"
                className={styles.popoverClose}
                onClick={toggleOpen}
                title={t('close')}
              >
                ×
              </button>
            </div>

            {/* Backend phase row */}
            <div className={styles.popoverBackendRow}>
              <span
                className={`${styles.backendDot} ${
                  backendPhase === 'running' && backendHealthy
                    ? styles.backendDotRunning
                    : backendPhase === 'starting' || snapshot.launching
                    ? styles.backendDotStarting
                    : backendPhase === 'error'
                    ? styles.backendDotError
                    : styles.backendDotStopped
                }`}
              />
              <span className={styles.popoverBackendLabel}>
                {snapshot.launching || backendPhase === 'starting'
                  ? t('backendStarting')
                  : backendPhase === 'running'
                  ? t('backendRunning')
                  : backendPhase === 'error'
                  ? t('backendError')
                  : t('backendStopped')}
              </span>
              {(backendPhase === 'stopped' || backendPhase === 'error') && (
                <button
                  type="button"
                  className={styles.popoverMiniBtn}
                  disabled={snapshot.backend.commanding}
                  onClick={() => { void controller.getBackendClient().start() }}
                >
                  {t('backendStart')}
                </button>
              )}
            </div>

            {/* Missing Credentials Warning Banner */}
            {entry.credentials.some(spec => spec.secret && readBackendPath(document, spec.path) === '') && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                padding: '6px 8px',
                fontSize: '11px',
                color: '#ef4444',
                lineHeight: '1.4',
              }}>
                ⚠️ 当前未配置 {provider} API Key，通话将无法正常回复，请在下方填写并保存。
              </div>
            )}

            {/* Provider */}
            <label className={styles.popoverField}>
              <span className={styles.popoverLabel}>{t('provider')}</span>
              <select
                className={styles.popoverSelect}
                value={provider}
                disabled={saving}
                onChange={(e) => { void applySelection({ provider: e.target.value }) }}
              >
                {PROVIDER_CATALOG.map((catalogEntry) => (
                  <option key={catalogEntry.id} value={catalogEntry.id}>
                    {t(catalogEntry.labelKey as VoiceSpiritKey)}
                  </option>
                ))}
              </select>
            </label>

            {/* Model */}
            <label className={styles.popoverField}>
              <span className={styles.popoverLabel}>{t('model')}</span>
              <select
                className={styles.popoverSelect}
                value={snapshot.engine.model || entry.models[0] || ''}
                disabled={saving}
                onChange={(e) => { void applySelection({ model: e.target.value }) }}
              >
                {entry.models.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </label>

            {/* Rich Voice Timbre Selector */}
            <div className={styles.popoverField}>
              <span className={styles.popoverLabel}>{t('voice')}</span>
              <VoiceSelector
                provider={provider}
                selectedVoice={snapshot.engine.voice || entry.voices[0] || ''}
                disabled={saving}
                onSelectVoice={(voiceId) => { void applySelection({ voice: voiceId }) }}
                t={t as (k: string) => string}
              />
            </div>

            {/* Credentials for the selected provider, editable inline */}
            {entry.credentials.length > 0 && (
              <>
                <div className={styles.popoverSectionLabel}>{t('sectionCredentials')}</div>
                {entry.credentials.map((spec) => {
                  const configured = readBackendPath(document, spec.path) !== ''
                  return (
                    <label key={spec.path} className={styles.popoverField}>
                      <span className={styles.popoverLabel}>
                        {t(spec.labelKey as VoiceSpiritKey)}{configured ? ' ✓' : ''}
                      </span>
                      <input
                        type={spec.secret ? 'password' : 'text'}
                        className={styles.popoverInput}
                        value={drafts[spec.path] ?? ''}
                        placeholder={configured ? '••••••••' : t(spec.placeholderKey as VoiceSpiritKey)}
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) => {
                          const text = e.target.value
                          setDrafts((prev) => ({ ...prev, [spec.path]: text }))
                          setKeysResult(undefined)
                        }}
                      />
                    </label>
                  )
                })}
                <div className={styles.popoverKeyActions}>
                  <button
                    type="button"
                    className={styles.popoverMiniBtn}
                    disabled={savingKeys}
                    onClick={() => { void saveKeys() }}
                  >
                    {savingKeys ? t('saving') : t('saveKeys')}
                  </button>
                  <span
                    className={`${styles.popoverKeyResult} ${
                      keysResult === 'failed' ? styles.popoverKeyResultFailed : ''
                    }`}
                  >
                    {keysResult === 'saved' ? t('keysSaved') : keysResult === 'failed' ? t('saveFailed') : ''}
                  </span>
                </div>
              </>
            )}

            <div className={styles.popoverHint}>{t(entry.hintKey as VoiceSpiritKey)}</div>
            {/* The realtime session reads provider/model/voice only at dial
                time — say so instead of letting a mid-call switch look live. */}
            {snapshot.engine.phase !== 'idle' && (
              <div className={styles.popoverHintDim}>{t('applyNextCall')}</div>
            )}
            <div className={styles.popoverHintDim}>{t('moreSettingsHint')}</div>
          </div>
        </>
      )}
    </div>
  )
}
