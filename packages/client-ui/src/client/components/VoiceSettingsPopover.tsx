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
  LIVE_TRANSLATE_TARGET_LANGUAGES,
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
  customTrigger?: (toggleOpen: () => void, isOpen: boolean) => React.ReactNode
}

export const VoiceSettingsPopover: React.FC<VoiceSettingsPopoverProps> = ({
  snapshot,
  controller,
  t,
  customTrigger,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [document, setDocument] = useState<BackendSettingsDocument | undefined>(undefined)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingKeys, setSavingKeys] = useState(false)
  const [keysResult, setKeysResult] = useState<'saved' | 'failed' | undefined>(undefined)
  const [showCredentials, setShowCredentials] = useState(false)
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({})

  const toggleVisibility = (path: string): void => {
    setVisibleKeys((prev) => ({ ...prev, [path]: !prev[path] }))
  }

  const provider = snapshot.engine.provider || 'DashScope'
  const entry = providerEntry(provider)
  const backendPhase = snapshot.backend.backend?.phase ?? 'stopped'
  const backendHealthy = snapshot.backend.backend?.healthy ?? false

  const hasMissingSecret = entry.credentials.some(
    spec => spec.secret && readBackendPath(document, spec.path) === ''
  )

  const toggleOpen = (): void => {
    const next = !isOpen
    setIsOpen(next)
    if (next) {
      // Fresh read each open so ✓ markers track what the backend holds now.
      setKeysResult(undefined)
      void controller.getBackendClient().fetchSettings().then((loaded) => {
        setDocument(loaded)
        const missing = entry.credentials.some(
          spec => spec.secret && readBackendPath(loaded, spec.path) === ''
        )
        if (missing) {
          setShowCredentials(true)
        }
      })
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
        void controller.getBackendClient().fetchSettings().then((loaded) => {
          setDocument(loaded)
          setShowCredentials(false)
        })
      } else {
        setKeysResult('failed')
      }
    } finally {
      setSavingKeys(false)
    }
  }

  return (
    <div className={styles.popoverAnchor}>
      {customTrigger ? (
        customTrigger(toggleOpen, isOpen)
      ) : (
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
      )}

      {isOpen && (
        <>
          <div className={styles.popoverScrim} onClick={toggleOpen} />
          <div className={styles.popoverPanel}>
            {/* 1. Header with title & close */}
            <div className={styles.popoverHeader}>
              <div className={styles.popoverHeaderLeft}>
                <span className={styles.popoverTitle}>{t('settingsTitle')}</span>
              </div>
              <button
                type="button"
                className={styles.popoverClose}
                onClick={toggleOpen}
                title={t('close')}
              >
                ×
              </button>
            </div>

            {/* 2. Scrollable Body - Never pushes popup outside screen */}
            <div className={styles.popoverScrollBody}>
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

              {/* Interaction Mode */}
              <div className={styles.popoverField}>
                <span className={styles.popoverLabel}>{t('modeDialogue')} / {t('modeTranslate')}</span>
                <div className={styles.modeSegmentControl} style={{ width: '100%' }}>
                  <button
                    type="button"
                    className={`${styles.modeSegmentBtn} ${snapshot.activeVoiceMode !== 'translate' ? styles.modeSegmentBtnActive : ''}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => { void controller.setVoiceMode('dialogue') }}
                  >
                    🗣️ {t('modeDialogue')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.modeSegmentBtn} ${snapshot.activeVoiceMode === 'translate' ? styles.modeSegmentBtnActive : ''}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => { void controller.setVoiceMode('translate') }}
                  >
                    🌐 {t('modeTranslate')}
                  </button>
                </div>
              </div>

              {/* LiveTranslate Language Pair Settings (shown in Translate mode) */}
              {snapshot.activeVoiceMode === 'translate' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px', background: 'rgba(59,130,246,0.06)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span className={styles.popoverLabel} style={{ fontSize: '11px' }}>{t('sourceLanguage')}</span>
                      <select
                        className={styles.popoverSelect}
                        value={snapshot.sourceLanguage}
                        onChange={(e) => { void controller.setLanguagePair(e.target.value, snapshot.targetLanguage) }}
                      >
                        {LIVE_TRANSLATE_TARGET_LANGUAGES.map((lang) => (
                          <option key={lang.value} value={lang.value}>{lang.flag} {lang.labelZh}</option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      className={styles.langSwapBtn}
                      style={{ marginTop: '14px', width: '24px', height: '24px', background: 'rgba(59,130,246,0.15)', borderRadius: '6px' }}
                      onClick={() => { void controller.swapLanguages() }}
                      title={t('swapLanguages')}
                    >
                      ⇄
                    </button>

                    <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span className={styles.popoverLabel} style={{ fontSize: '11px' }}>{t('targetLanguage')}</span>
                      <select
                        className={styles.popoverSelect}
                        value={snapshot.targetLanguage}
                        onChange={(e) => { void controller.setLanguagePair(snapshot.sourceLanguage, e.target.value) }}
                      >
                        {LIVE_TRANSLATE_TARGET_LANGUAGES.map((lang) => (
                          <option key={lang.value} value={lang.value}>{lang.flag} {lang.labelZh}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Echo Audio Toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', color: 'var(--dsw-alias-label-secondary, #9ca3af)' }}>
                    <input
                      type="checkbox"
                      checked={snapshot.echoTargetLanguage}
                      onChange={() => { void controller.toggleEchoTargetLanguage() }}
                    />
                    <span>{t('echoTranslation')}</span>
                  </label>
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

              {/* Smart Credentials Accordion / Card */}
              {entry.credentials.length > 0 && (
                <div className={styles.popoverCredCard}>
                  <div className={styles.popoverCredHeader}>
                    <div className={styles.popoverCredStatus}>
                      <span style={{ color: hasMissingSecret ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                        {hasMissingSecret ? '⚠️' : '✓'}
                      </span>
                      <span>
                        {t('sectionCredentials')}: {hasMissingSecret ? '待配置' : '已就绪'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.popoverCredToggleBtn}
                      onClick={() => { setShowCredentials(!showCredentials) }}
                    >
                      {showCredentials ? '收起' : hasMissingSecret ? '填写密钥' : '修改密钥'}
                    </button>
                  </div>

                  {showCredentials && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      {hasMissingSecret && (
                        <div style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          color: '#ef4444',
                          lineHeight: '1.4',
                        }}>
                          当前未配置 {provider} 密钥，通话将无法正常回复。
                        </div>
                      )}
                      {entry.credentials.map((spec) => {
                        const configuredValue = readBackendPath(document, spec.path)
                        const configured = configuredValue !== ''
                        const isSecret = spec.secret
                        const isVisible = visibleKeys[spec.path] === true
                        const currentDraft = drafts[spec.path]
                        const displayValue = currentDraft !== undefined ? currentDraft : (configured ? configuredValue : '')

                        return (
                          <label key={spec.path} className={styles.popoverField}>
                            <span className={styles.popoverLabel}>
                              {t(spec.labelKey as VoiceSpiritKey)}{configured ? ' ✓' : ''}
                            </span>
                            <div className={styles.inputWrapper}>
                              <input
                                type={isSecret && !isVisible ? 'password' : 'text'}
                                className={styles.popoverInput}
                                value={displayValue}
                                placeholder={t(spec.placeholderKey as VoiceSpiritKey)}
                                autoComplete="off"
                                spellCheck={false}
                                onChange={(e) => {
                                  const text = e.target.value
                                  setDrafts((prev) => ({ ...prev, [spec.path]: text }))
                                  setKeysResult(undefined)
                                }}
                              />
                              {isSecret && (
                                <button
                                  type="button"
                                  className={styles.eyeBtn}
                                  onClick={() => { toggleVisibility(spec.path) }}
                                  title={isVisible ? '隐藏内容' : '显示内容'}
                                >
                                  {isVisible ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                      <line x1="1" y1="1" x2="23" y2="23" />
                                    </svg>
                                  ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                      <circle cx="12" cy="12" r="3" />
                                    </svg>
                                  )}
                                </button>
                              )}
                            </div>
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
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Sticky Footer */}
            <div className={styles.popoverFooter}>
              <span>{snapshot.engine.phase !== 'idle' ? t('applyNextCall') : t('moreSettingsHint')}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
