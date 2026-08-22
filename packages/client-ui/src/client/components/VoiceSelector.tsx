/**
 * Unified Voice Selector Component for VoiceSpirit
 * Provides rich card grid, gender/tag filters, search, and human-readable timbre labels.
 */

import React, { useMemo, useState } from 'react'
import {
  getProviderVoices,
  type VoiceCatalogEntry,
  type VoiceGender,
} from '../contract/voice-catalog.ts'
import styles from './VoiceCall.module.css'

export interface VoiceSelectorProps {
  provider: string
  selectedVoice: string
  disabled?: boolean
  onSelectVoice: (voiceId: string) => void
  t: (key: string) => string
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  provider,
  selectedVoice,
  disabled = false,
  onSelectVoice,
  t,
}) => {
  const [filterGender, setFilterGender] = useState<VoiceGender | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCustom, setShowCustom] = useState(false)

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
    <div className={styles.voiceSelectorContainer} style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {/* 1. Header with search & filter pills */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        {/* Gender Filter Pills */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.05)', padding: '2px', borderRadius: '6px' }}>
          {(['all', 'female', 'male'] as const).map((g) => (
            <button
              key={g}
              type="button"
              disabled={disabled}
              onClick={() => { setFilterGender(g) }}
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                border: 'none',
                borderRadius: '4px',
                background: filterGender === g ? 'var(--dsh-accent, #10a37f)' : 'transparent',
                color: filterGender === g ? '#fff' : 'inherit',
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
          placeholder="搜索音色/风格..."
          value={searchQuery}
          disabled={disabled}
          onChange={e => { setSearchQuery(e.target.value) }}
          style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(128,128,128,0.25)',
            background: 'transparent',
            outline: 'none',
            maxWidth: '120px',
          }}
        />
      </div>

      {/* 2. Voice Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: '6px',
          maxHeight: '180px',
          overflowY: 'auto',
          paddingRight: '2px',
        }}
      >
        {filteredVoices.map((voice) => {
          const isSelected = voice.id === selectedVoice
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
                borderRadius: '6px',
                border: isSelected
                  ? '1.5px solid var(--dsh-accent, #10a37f)'
                  : '1px solid rgba(128,128,128,0.18)',
                background: isSelected
                  ? 'rgba(16, 163, 127, 0.08)'
                  : 'rgba(128,128,128,0.04)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              {/* Voice Name & Gender Icon */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: isSelected ? 'var(--dsh-accent, #10a37f)' : 'inherit' }}>
                  {voice.displayName}
                </span>
                <span style={{ fontSize: '10px', opacity: 0.6 }}>
                  {voice.gender === 'female' ? '♀' : voice.gender === 'male' ? '♂' : '⚲'}
                </span>
              </div>

              {/* Chinese readable name & tags */}
              <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                {voice.displayNameZh.replace(/\s*\([^)]*\)/, '')}
              </div>

              {/* Tag badges */}
              <div style={{ display: 'flex', gap: '2px', marginTop: '4px', flexWrap: 'wrap' }}>
                {voice.tags.slice(0, 2).map(tag => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '9px',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      background: 'rgba(128,128,128,0.12)',
                      opacity: 0.85,
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
          <div style={{ gridColumn: '1 / -1', fontSize: '11px', textAlign: 'center', opacity: 0.6, padding: '12px 0' }}>
            未找到匹配音色
          </div>
        )}
      </div>

      {/* 3. Custom / Advanced Voice ID Toggle */}
      <div style={{ marginTop: '2px' }}>
        <button
          type="button"
          onClick={() => { setShowCustom(!showCustom) }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '11px',
            color: 'var(--dsh-accent, #10a37f)',
            cursor: 'pointer',
            padding: '0',
            opacity: 0.85,
            textDecoration: 'underline',
          }}
        >
          {showCustom ? '收起自定义 ID' : isCustomSelected ? `自定义音色: ${selectedVoice}` : '+ 输入自定义音色 ID'}
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
                borderRadius: '4px',
                border: '1px solid rgba(128,128,128,0.25)',
                background: 'transparent',
                outline: 'none',
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
