/**
 * Unified Voice Selector Component for VoiceSpirit
 * Provides rich card grid, gender/tag filters, search, and human-readable timbre labels.
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  getProviderVoices,
  type VoiceGender,
} from '../contract/voice-catalog.ts'
import styles from './VoiceCall.module.css'

export interface VoiceSelectorProps {
  provider: string
  selectedVoice: string
  disabled?: boolean
  onSelectVoice: (voiceId: string) => void
  t?: (key: string) => string
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  provider,
  selectedVoice,
  disabled = false,
  onSelectVoice,
  t: _t,
}) => {
  const [filterGender, setFilterGender] = useState<VoiceGender | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  // Reset filter & search when provider changes
  useEffect(() => {
    setSearchQuery('')
    setFilterGender('all')
  }, [provider])

  const catalog = useMemo(() => getProviderVoices(provider), [provider])

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
              {/* Header: Name + Gender badge + Selection Checkmark */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 3px',
                      borderRadius: '3px',
                      background: genderBg,
                      color: genderColor,
                      fontWeight: 600,
                      lineHeight: 1,
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
                </div>
                {isSelected && (
                  <span style={{ fontSize: '11px', color: 'var(--dsw-alias-state-business-primary, #3b82f6)', fontWeight: 700 }}>
                    ✓
                  </span>
                )}
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

      {/* 3. Custom / Advanced Voice ID Toggle */}
      <div style={{ marginTop: '1px' }}>
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
      </div>
    </div>
  )
}
