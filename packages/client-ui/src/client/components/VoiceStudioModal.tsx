/**
 * Voice Studio Modal for VoiceSpirit (Echo)
 * Allows users to:
 * 1. Design custom voices with prompts (e.g. Qwen / Xiaomi voice design)
 * 2. Clone voices from audio reference samples
 * 3. Manage, preview, and apply custom created voices
 */

import React, { useEffect, useRef, useState } from 'react'
import type { VoiceSpiritBackend } from '../backend.ts'
import type { VoiceSpiritKey } from '../locales.ts'
import styles from './VoiceCall.module.css'

export interface CustomVoiceItem {
  voice: string
  preferred_name?: string
  type?: 'voice_design' | 'voice_clone'
  provider?: string
}

export interface VoiceStudioModalProps {
  open: boolean
  onClose: () => void
  provider: string
  backend: VoiceSpiritBackend
  onSelectVoice: (voiceId: string) => void
  t: (key: VoiceSpiritKey) => string
}

export const VoiceStudioModal: React.FC<VoiceStudioModalProps> = ({
  open,
  onClose,
  provider,
  backend,
  onSelectVoice,
  t,
}) => {
  const [activeTab, setActiveTab] = useState<'design' | 'clone' | 'library'>('design')

  // Voice Design states
  const [designName, setDesignName] = useState('知性女声')
  const [designPrompt, setDesignPrompt] = useState('温婉知性的女声，语速适中，吐字清晰，富有治愈感与亲和力')
  const [designPreviewText, setDesignPreviewText] = useState('您好！我是您的专属 AI 语音助手，很高兴今天能为您提供帮助。')
  const [designLanguage, setDesignLanguage] = useState('zh')
  const [isDesigning, setIsDesigning] = useState(false)
  const [designResultVoiceId, setDesignResultVoiceId] = useState<string | null>(null)
  const [_designPreviewAudioSrc, setDesignPreviewAudioSrc] = useState<string | null>(null)

  // Voice Clone states
  const [cloneName, setCloneName] = useState('我的声音')
  const [cloneFile, setCloneFile] = useState<File | null>(null)
  const [isCloning, setIsCloning] = useState(false)

  // Library states
  const [customVoices, setCustomVoices] = useState<CustomVoiceItem[]>([])
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false)
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setPreviewingVoiceId(null)
  }

  const loadLibrary = async () => {
    setIsLoadingLibrary(true)
    try {
      const res = await backend.fetchCustomVoices('voice_design', provider)
      if (res.ok) {
        setCustomVoices(res.voices as CustomVoiceItem[])
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingLibrary(false)
    }
  }

  useEffect(() => {
    if (open) {
      void loadLibrary()
      setStatusMessage(null)
    } else {
      stopAudio()
    }
  }, [open, provider])

  if (!open) return null

  const handleDesignVoice = async () => {
    if (!designPrompt.trim() || !designName.trim()) {
      setStatusMessage({ text: '请填写音色名称和描述提示词', isError: true })
      return
    }

    setIsDesigning(true)
    setStatusMessage(null)
    stopAudio()

    try {
      const res = await backend.createVoiceDesign({
        preferred_name: designName.trim(),
        voice_prompt: designPrompt.trim(),
        preview_text: designPreviewText.trim() || '您好，很高兴为您服务。',
        language: designLanguage,
        provider: provider.toLowerCase().includes('dashscope') ? 'qwen' : provider.toLowerCase(),
      })

      if (res.ok) {
        const val = res.value as { voice?: string; preview_audio_data?: string }
        const voiceId = val?.voice || designName.trim()
        setDesignResultVoiceId(voiceId)
        setStatusMessage({ text: t('voiceGenerated'), isError: false })

        if (val?.preview_audio_data) {
          const audioSrc = val.preview_audio_data.startsWith('data:')
            ? val.preview_audio_data
            : `data:audio/mp3;base64,${val.preview_audio_data}`
          setDesignPreviewAudioSrc(audioSrc)
          const audio = new Audio(audioSrc)
          audioRef.current = audio
          audio.play().catch(() => {})
        } else {
          // Play via backend TTS proxy
          const audioSrc = `/api/voicespirit/tts/speak?text=${encodeURIComponent(designPreviewText)}&voice=${encodeURIComponent(voiceId)}`
          setDesignPreviewAudioSrc(audioSrc)
          const audio = new Audio(audioSrc)
          audioRef.current = audio
          audio.play().catch(() => {})
        }

        void loadLibrary()
      } else {
        setStatusMessage({ text: res.error || '生成音色失败', isError: true })
      }
    } catch (e) {
      setStatusMessage({ text: String(e), isError: true })
    } finally {
      setIsDesigning(false)
    }
  }

  const handleDeleteVoice = async (voiceName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(t('confirmDeleteVoice'))) return

    try {
      const res = await backend.deleteCustomVoice(voiceName, 'voice_design', provider)
      if (res.ok) {
        void loadLibrary()
      }
    } catch {
      // Ignored
    }
  }

  const handlePlayPreview = (voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (previewingVoiceId === voiceId) {
      stopAudio()
      return
    }

    stopAudio()
    setPreviewingVoiceId(voiceId)

    const audioSrc = `/api/voicespirit/tts/speak?text=${encodeURIComponent('您好，这是我的专属自定义音色试听样本。')}&voice=${encodeURIComponent(voiceId)}`
    const audio = new Audio(audioSrc)
    audioRef.current = audio
    audio.onended = () => {
      setPreviewingVoiceId(null)
      audioRef.current = null
    }
    audio.onerror = () => {
      setPreviewingVoiceId(null)
    }
    audio.play().catch(() => {
      setPreviewingVoiceId(null)
    })
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          background: 'var(--dsw-alias-surface-panel-floating, #18191c)',
          border: '1px solid var(--dsw-alias-border-l1-darkmode, rgba(255, 255, 255, 0.15))',
          borderRadius: '16px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          color: 'var(--dsw-alias-label-primary, #f3f4f6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(255, 255, 255, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>✨</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{t('voiceStudio')}</h3>
              <p style={{ margin: 0, fontSize: '11px', opacity: 0.7 }}>{t('voiceStudioDesc')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '18px',
              opacity: 0.6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab navigation */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '10px 20px',
            background: 'var(--dsw-specific-selector, rgba(255, 255, 255, 0.03))',
            borderBottom: '1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(255, 255, 255, 0.06))',
          }}
        >
          <button
            type="button"
            onClick={() => { setActiveTab('design') }}
            style={{
              flex: 1,
              padding: '7px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'design' ? 'var(--dsw-alias-state-business-primary, #3b82f6)' : 'transparent',
              color: activeTab === 'design' ? '#fff' : 'inherit',
              fontWeight: activeTab === 'design' ? 600 : 400,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            ✨ {t('tabVoiceDesign')}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('clone') }}
            style={{
              flex: 1,
              padding: '7px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'clone' ? 'var(--dsw-alias-state-business-primary, #3b82f6)' : 'transparent',
              color: activeTab === 'clone' ? '#fff' : 'inherit',
              fontWeight: activeTab === 'clone' ? 600 : 400,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            🎙️ {t('tabVoiceClone')}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('library') }}
            style={{
              flex: 1,
              padding: '7px 12px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'library' ? 'var(--dsw-alias-state-business-primary, #3b82f6)' : 'transparent',
              color: activeTab === 'library' ? '#fff' : 'inherit',
              fontWeight: activeTab === 'library' ? 600 : 400,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            📁 {t('myCustomVoices')} ({customVoices.length})
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', maxHeight: '420px', overflowY: 'auto' }}>
          {statusMessage && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                marginBottom: '14px',
                fontSize: '12px',
                background: statusMessage.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                color: statusMessage.isError ? '#f87171' : '#4ade80',
                border: `1px solid ${statusMessage.isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
              }}
            >
              {statusMessage.text}
            </div>
          )}

          {/* TAB 1: Voice Design */}
          {activeTab === 'design' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {t('voicePreferredName')}
                </label>
                <input
                  type="text"
                  value={designName}
                  placeholder={t('voicePreferredNameHint')}
                  onChange={e => { setDesignName(e.target.value) }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(255,255,255,0.12))',
                    background: 'var(--dsw-specific-selector, rgba(255,255,255,0.05))',
                    color: 'inherit',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {t('voicePromptLabel')}
                </label>
                <textarea
                  rows={3}
                  value={designPrompt}
                  placeholder={t('voicePromptHint')}
                  onChange={e => { setDesignPrompt(e.target.value) }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(255,255,255,0.12))',
                    background: 'var(--dsw-specific-selector, rgba(255,255,255,0.05))',
                    color: 'inherit',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
                <span style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px', display: 'block' }}>
                  {t('voicePromptHint')}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {t('previewTextLabel')}
                </label>
                <input
                  type="text"
                  value={designPreviewText}
                  placeholder={t('previewTextHint')}
                  onChange={e => { setDesignPreviewText(e.target.value) }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(255,255,255,0.12))',
                    background: 'var(--dsw-specific-selector, rgba(255,255,255,0.05))',
                    color: 'inherit',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                <button
                  type="button"
                  disabled={isDesigning}
                  onClick={handleDesignVoice}
                  style={{
                    flex: 1,
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--dsw-alias-state-business-primary, #3b82f6)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: isDesigning ? 'wait' : 'pointer',
                    opacity: isDesigning ? 0.7 : 1,
                  }}
                >
                  {isDesigning ? t('generatingVoice') : t('generateVoice')}
                </button>

                {designResultVoiceId && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectVoice(designResultVoiceId)
                      onClose()
                    }}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--dsw-alias-state-business-primary, #3b82f6)',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--dsw-alias-state-business-primary, #3b82f6)',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    ✓ {t('applyVoice')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Voice Clone */}
          {activeTab === 'clone' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {t('voicePreferredName')}
                </label>
                <input
                  type="text"
                  value={cloneName}
                  placeholder={t('voicePreferredNameHint')}
                  onChange={e => { setCloneName(e.target.value) }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(255,255,255,0.12))',
                    background: 'var(--dsw-specific-selector, rgba(255,255,255,0.05))',
                    color: 'inherit',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  {t('uploadAudioRef')}
                </label>
                <div
                  style={{
                    border: '2px dashed var(--dsw-alias-border-l2-darkmode-thin, rgba(255,255,255,0.2))',
                    borderRadius: '10px',
                    padding: '24px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'var(--dsw-specific-selector, rgba(255,255,255,0.02))',
                  }}
                  onClick={() => {
                    document.getElementById('voice-clone-file-input')?.click()
                  }}
                >
                  <input
                    id="voice-clone-file-input"
                    type="file"
                    accept="audio/*"
                    style={{ display: 'none' }}
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setCloneFile(e.target.files[0])
                      }
                    }}
                  />
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎙️</div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>
                    {cloneFile ? cloneFile.name : '点击或拖拽音频文件到此处'}
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '4px' }}>
                    {t('uploadAudioHint')}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={!cloneFile || isCloning}
                onClick={async () => {
                  if (!cloneFile) return
                  setIsCloning(true)
                  setStatusMessage(null)
                  try {
                    const formData = new FormData()
                    formData.append('preferred_name', cloneName.trim())
                    formData.append('audio_file', cloneFile)
                    formData.append('provider', provider.toLowerCase().includes('dashscope') ? 'qwen' : provider.toLowerCase())

                    const resp = await fetch('/api/voicespirit/voices/clone', {
                      method: 'POST',
                      body: formData,
                    })
                    const body = await resp.json()
                    if (resp.ok && body.ok !== false) {
                      const voiceId = body.voice || cloneName.trim()
                      setStatusMessage({ text: '音色克隆成功！', isError: false })
                      void loadLibrary()
                      onSelectVoice(voiceId)
                    } else {
                      setStatusMessage({ text: body.error || '克隆失败', isError: true })
                    }
                  } catch (e) {
                    setStatusMessage({ text: String(e), isError: true })
                  } finally {
                    setIsCloning(false)
                  }
                }}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--dsw-alias-state-business-primary, #3b82f6)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: cloneFile && !isCloning ? 'pointer' : 'not-allowed',
                  opacity: cloneFile && !isCloning ? 1 : 0.6,
                }}
              >
                {isCloning ? '正在克隆音色…' : '✨ 开始克隆专属音色'}
              </button>
            </div>
          )}

          {/* TAB 3: My Library */}
          {activeTab === 'library' && (
            <div>
              {isLoadingLibrary ? (
                <div style={{ textAlign: 'center', padding: '24px 0', opacity: 0.6, fontSize: '13px' }}>
                  正在加载音色库…
                </div>
              ) : customVoices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', opacity: 0.6, fontSize: '13px' }}>
                  {t('noCustomVoices')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {customVoices.map((cv) => {
                    const isPreviewing = previewingVoiceId === cv.voice
                    const isClone = cv.type === 'voice_clone'
                    return (
                      <div
                        key={cv.voice}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: 'var(--dsw-specific-selector, rgba(255,255,255,0.04))',
                          border: '1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(255,255,255,0.08))',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '2px 5px',
                              borderRadius: '4px',
                              background: isClone ? 'rgba(236, 72, 153, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                              color: isClone ? '#f472b6' : '#60a5fa',
                              fontWeight: 600,
                            }}
                          >
                            {isClone ? '✨ 克隆' : '✨ 设计'}
                          </span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>
                              {cv.preferred_name || cv.voice}
                            </div>
                            <div style={{ fontSize: '11px', opacity: 0.6 }}>
                              ID: {cv.voice}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {/* Play Preview */}
                          <button
                            type="button"
                            className={`${styles.miniBtn}`}
                            onClick={(e) => { handlePlayPreview(cv.voice, e) }}
                          >
                            {isPreviewing ? '⏹ 停止' : '▶ 试听'}
                          </button>

                          {/* Apply */}
                          <button
                            type="button"
                            className={`${styles.miniBtn}`}
                            style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}
                            onClick={() => {
                              onSelectVoice(cv.voice)
                              onClose()
                            }}
                          >
                            ✓ 使用
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            className={`${styles.miniBtn}`}
                            style={{ color: '#f87171' }}
                            onClick={(e) => { void handleDeleteVoice(cv.voice, e) }}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
