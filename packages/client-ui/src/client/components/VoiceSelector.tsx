/**
 * Unified Voice Selector Component for VoiceSpirit
 * Provides rich card grid, gender/tag filters, search, human-readable timbre labels,
 * and one-click voice sample preview playback.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { VoiceSpiritBackend } from '../backend.ts'
import {
  getProviderVoices,
  type VoiceCatalogEntry,
  type VoiceGender,
} from '../contract/voice-catalog.ts'
import { PRESET_VOICE_SAMPLES } from '../contract/voice-samples.ts'
import { VoiceStudioModal } from './VoiceStudioModal.tsx'
import type { VoiceSpiritKey } from '../locales.ts'
import styles from './VoiceCall.module.css'

export interface VoiceSelectorProps {
  provider: string
  selectedVoice: string
  disabled?: boolean
  backend?: VoiceSpiritBackend
  onSelectVoice: (voiceId: string) => void
  t?: (key: string) => string
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  provider,
  selectedVoice,
  disabled = false,
  backend,
  onSelectVoice,
  t: _t,
}) => {
  const [filterGender, setFilterGender] = useState<VoiceGender | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [showStudioModal, setShowStudioModal] = useState(false)
  const [customVoices, setCustomVoices] = useState<Array<{ voice: string; preferred_name?: string; type?: string; provider?: string }>>([])
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setPreviewingVoiceId(null)
  }

  // Load custom voices from backend if available
  useEffect(() => {
    if (backend) {
      void backend.fetchCustomVoices('voice_design', provider).then((res) => {
        if (res.ok) {
          setCustomVoices(res.voices)
        }
      })
    }
  }, [backend, provider])

  // Reset filter, search & stop preview when provider changes or unmounts
  useEffect(() => {
    setSearchQuery('')
    setFilterGender('all')
    stopPreview()
    return () => {
      stopPreview()
    }
  }, [provider])

  const catalog = useMemo(() => getProviderVoices(provider, customVoices), [provider, customVoices])

  const filteredVoices = useMemo(() => {
    return catalog.filter((voice) => {
      if (filterGender !== 'all' && voice.gender !== filterGender) return false
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase()
        const matchName = voice.displayName.toLowerCase().includes(q)
        const matchZh = voice.displayNameZh.toLowerCase().includes(q)
        const matchTag = voice.tags.some(tag => tag.toLowerCase().includes(q))
        if (!matchName && !matchZh && !matchTag) return false
      }
      return true
    })
  }, [catalog, filterGender, searchQuery])

  const currentVoiceObj = useMemo(
    () => catalog.find(v => v.id === selectedVoice),
    [catalog, selectedVoice]
  )

  const isCustomSelected = !currentVoiceObj && selectedVoice !== ''

  const handleTogglePreview = (voice: VoiceCatalogEntry, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (previewingVoiceId === voice.id) {
      stopPreview()
      return
    }

    stopPreview()
    setPreviewingVoiceId(voice.id)

    const isEn = voice.language.startsWith('en')
    const sampleText = isEn
      ? `Hello! I am ${voice.displayName}, nice to meet you.`
      : `您好，我是 ${voice.displayName}，很高兴为您服务。`

    // 1. Instant 0ms playback if pre-rendered preset sample is available
    const presetSample = PRESET_VOICE_SAMPLES[voice.id]

    // 2. Fallback to live backend TTS proxy for custom/fine-tuned IDs
    let engine = 'edge'
    const normProvider = provider.toLowerCase()
    if (normProvider.includes('dashscope')) {
      engine = 'qwen_flash'
    } else if (normProvider.includes('cartesia')) {
      engine = 'cartesia'
    } else if (normProvider.includes('doubao')) {
      engine = 'doubao'
    } else if (normProvider.includes('openai')) {
      engine = 'openai'
    } else if (normProvider.includes('xiaomi')) {
      engine = 'xiaomi'
    }

    const audioSrc = presetSample || `/api/voicespirit/tts/speak?text=${encodeURIComponent(sampleText)}&voice=${encodeURIComponent(voice.id)}&engine=${encodeURIComponent(engine)}`

    const audio = new Audio(audioSrc)
    audioRef.current = audio

    audio.onended = () => {
      setPreviewingVoiceId(null)
      audioRef.current = null
    }

    audio.onerror = () => {
      // Fallback to browser SpeechSynthesis if audio playback fails
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(sampleText)
        utterance.lang = isEn ? 'en-US' : 'zh-CN'
        utterance.onend = () => {
          setPreviewingVoiceId(null)
        }
        utterance.onerror = () => {
          setPreviewingVoiceId(null)
        }
        window.speechSynthesis.speak(utterance)
      } else {
        setPreviewingVoiceId(null)
      }
    }

    audio.play().catch(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(sampleText)
        utterance.lang = isEn ? 'en-US' : 'zh-CN'
        utterance.onend = () => {
          setPreviewingVoiceId(null)
        }
        utterance.onerror = () => {
          setPreviewingVoiceId(null)
        }
        window.speechSynthesis.speak(utterance)
      } else {
        setPreviewingVoiceId(null)
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {/* 1. Header with search & filter pills */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        {/* Gender Filter Pills */}
        <div style={{ display: 'flex', gap: '2px', background: 'var(--dsw-specific-selector, rgba(255,255,255,0.06))', padding: '2px', borderRadius: '7px' }}>
          {(['all', 'female', 'male'] as const).map((g) => (
            <button
              key={g}
              type="button"
              disabled={disabled}
              onClick={() => { setFilterGender(g) }}
              style={{
                fontSize: '11px',
                padding: '2px 7px',
                border: 'none',
                borderRadius: '5px',
                background: filterGender === g ? 'var(--dsw-alias-state-business-primary, #3b82f6)' : 'transparent',
                color: filterGender === g ? '#fff' : 'var(--dsw-alias-label-secondary, #9ca3af)',
                cursor: 'pointer',
                fontWeight: filterGender === g ? 600 : 400,
                transition: 'all 0.15s ease',
              }}
            >
              {g === 'all' ? '全部' : g === 'female' ? '♀ 女声' : '♂ 男声'}
            </button>
          ))}
        </div>

        {/* Search input */}
        <input
          type="text"
          placeholder="搜索音色/风格…"
          value={searchQuery}
          disabled={disabled}
          onChange={e => { setSearchQuery(e.target.value) }}
          style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '6px',
            border: '1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(255,255,255,0.12))',
            background: 'var(--dsw-specific-selector, rgba(255,255,255,0.04))',
            color: 'inherit',
            outline: 'none',
            maxWidth: '110px',
          }}
        />
      </div>

      {/* 2. Voice Cards Grid - Fixed height to avoid popover height jumps */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '6px',
          height: '144px',
          minHeight: '144px',
          maxHeight: '144px',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: '2px',
          boxSizing: 'border-box',
          width: '100%',
        }}
      >
        {filteredVoices.map((voice) => {
          const isSelected = voice.id === selectedVoice
          const isPreviewing = previewingVoiceId === voice.id
          const isFemale = voice.gender === 'female'
          const isMale = voice.gender === 'male'
          const genderColor = isFemale ? '#ec4899' : isMale ? '#38bdf8' : '#9ca3af'
          const genderBg = isFemale ? 'rgba(236, 72, 153, 0.12)' : isMale ? 'rgba(56, 189, 248, 0.12)' : 'rgba(156, 163, 175, 0.12)'

          return (
            <button
              key={voice.id}
              type="button"
              disabled={disabled}
              onClick={() => { onSelectVoice(voice.id) }}
              title={voice.descriptionZh || voice.description || voice.displayNameZh}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                padding: '6px 8px',
                borderRadius: '8px',
                border: isSelected
                  ? '1.5px solid var(--dsw-alias-state-business-primary, #3b82f6)'
                  : '1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(255,255,255,0.08))',
                background: isSelected
                  ? 'rgba(59, 130, 246, 0.12)'
                  : 'var(--dsw-specific-selector, rgba(255,255,255,0.03))',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
                boxShadow: isSelected ? '0 0 0 1px var(--dsw-alias-state-business-primary, #3b82f6)' : 'none',
              }}
            >
              {/* Header: Name + Gender badge + Preview Button + Checkmark */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 3px',
                      borderRadius: '3px',
                      background: genderBg,
                      color: genderColor,
                      fontWeight: 600,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    {isFemale ? '♀' : isMale ? '♂' : '⚲'}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: isSelected ? 'var(--dsw-alias-state-business-primary, #3b82f6)' : 'inherit',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {voice.displayName}
                  </span>
                  {isSelected && (
                    <span style={{ fontSize: '11px', color: 'var(--dsw-alias-state-business-primary, #3b82f6)', fontWeight: 700, flexShrink: 0 }}>
                      ✓
                    </span>
                  )}
                </div>

                {/* Audio Sample Preview Button */}
                <button
                  type="button"
                  className={`${styles.voicePreviewBtn} ${isPreviewing ? styles.voicePreviewBtnActive : ''}`}
                  onClick={(e) => { handleTogglePreview(voice, e) }}
                  title={isPreviewing ? '停止试听' : '试听该音色'}
                >
                  {isPreviewing ? (
                    <>
                      <span className={styles.previewPlayingBars}>
                        <span className={styles.previewPlayingBar} />
                        <span className={styles.previewPlayingBar} />
                        <span className={styles.previewPlayingBar} />
                      </span>
                      <span>停止</span>
                    </>
                  ) : (
                    <>
                      <span>▶</span>
                      <span>试听</span>
                    </>
                  )}
                </button>
              </div>

              {/* Chinese readable name & vibe */}
              <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                {voice.displayNameZh.replace(/\s*\([^)]*\)/, '')}
              </div>

              {/* Tag badges */}
              <div style={{ display: 'flex', gap: '3px', marginTop: '3px', flexWrap: 'wrap' }}>
                {voice.tags.slice(0, 2).map(tag => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '9px',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      background: 'var(--dsw-specific-selector, rgba(255,255,255,0.06))',
                      opacity: 0.8,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          )
        })}

        {filteredVoices.length === 0 && (
          <div style={{ gridColumn: '1 / -1', fontSize: '11px', textAlign: 'center', opacity: 0.6, padding: '16px 0' }}>
            未找到匹配音色
          </div>
        )}
      </div>

      {/* 3. Custom / Voice Studio & Advanced Voice ID */}
      <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {backend && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => { setShowStudioModal(true) }}
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(147, 51, 234, 0.15))',
                border: '1px solid rgba(147, 51, 234, 0.3)',
                borderRadius: '6px',
                fontSize: '11px',
                color: 'var(--dsw-alias-label-primary, #f3f4f6)',
                cursor: 'pointer',
                padding: '2px 8px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>✨</span>
              <span>声音工坊</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => { setShowCustom(!showCustom) }}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '11px',
              color: 'var(--dsw-alias-state-business-primary, #3b82f6)',
              cursor: 'pointer',
              padding: '0',
              opacity: 0.85,
              textDecoration: 'underline',
            }}
          >
            {showCustom ? '收起自定义 ID' : isCustomSelected ? `自定义音色: ${selectedVoice}` : '+ 自定义音色 ID'}
          </button>
        </div>
      </div>

      {showCustom && (
        <div style={{ marginTop: '4px', display: 'flex', gap: '6px' }}>
          <input
            type="text"
            placeholder="输入音色唯一 ID (如自定义微调音色)"
            value={selectedVoice}
            disabled={disabled}
            onChange={e => { onSelectVoice(e.target.value.trim()) }}
            style={{
              flex: 1,
              fontSize: '11px',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid var(--dsw-alias-border-l2-darkmode-thin, rgba(255,255,255,0.15))',
              background: 'var(--dsw-specific-selector, rgba(255,255,255,0.06))',
              color: 'inherit',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Voice Studio Creation & Management Modal */}
      {backend && (
        <VoiceStudioModal
          open={showStudioModal}
          onClose={() => {
            setShowStudioModal(false)
            // Reload custom voices list
            void backend.fetchCustomVoices('voice_design', provider).then((res) => {
              if (res.ok) setCustomVoices(res.voices)
            })
          }}
          provider={provider}
          backend={backend}
          onSelectVoice={onSelectVoice}
          t={_t as (k: VoiceSpiritKey) => string}
        />
      )}
    </div>
  )
}
