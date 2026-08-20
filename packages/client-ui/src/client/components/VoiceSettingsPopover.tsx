import React, { useState } from 'react'
import type { VoiceCallOptions } from '../engine/VoiceAudioEngine.ts'
import styles from './VoiceCall.module.css'

export interface VoiceSettingsPopoverProps {
  options: Partial<VoiceCallOptions>
  onChange: (options: Partial<VoiceCallOptions>) => void
  onClose?: () => void
  t: (key: any) => string
}

export const PROVIDERS = [
  { id: 'Cartesia', name: 'Cartesia (DeepSeek 脑 + Ink-2 听 + Sonic 发音 - 推荐)' },
  { id: 'DashScope', name: 'DashScope (Qwen-Omni 全双工端到端)' },
  { id: 'Doubao', name: 'Doubao (火山引擎 OpenSpeech)' },
  { id: 'OpenAI', name: 'OpenAI (GPT-4o Realtime)' },
  { id: 'Google', name: 'Google (Gemini Live 实时多模态)' },
  { id: 'PersonaPlex', name: 'PersonaPlex (NVIDIA 本地英语陪练)' },
  { id: 'GLM4Voice', name: 'GLM-4-Voice (智谱语音端到端)' },
]

export const MODELS_BY_PROVIDER: Record<string, Array<{ id: string; name: string }>> = {
  Cartesia: [
    { id: 'cartesia-realtime', name: 'Cartesia Realtime (DeepSeek LLM + Ink-2 + Sonic)' },
  ],
  DashScope: [
    { id: 'qwen3.5-omni-plus-realtime', name: 'Qwen3.5-Omni-Plus (全双工多模态旗舰)' },
    { id: 'qwen3.5-omni-flash-realtime', name: 'Qwen3.5-Omni-Flash (极速低延迟)' },
    { id: 'qwen-audio-3.0-realtime-plus', name: 'Qwen-Audio-3.0-Plus (原声语音)' },
    { id: 'qwen3.5-livetranslate-realtime', name: 'Qwen3.5-LiveTranslate (实时同传翻译)' },
  ],
  Doubao: [
    { id: 'doubao-realtime', name: 'Doubao Realtime (火山引擎端到端)' },
  ],
  OpenAI: [
    { id: 'gpt-realtime-2', name: 'GPT-4o Realtime 2.0' },
    { id: 'gpt-4o-realtime-preview', name: 'GPT-4o Realtime Preview' },
  ],
  Google: [
    { id: 'gemini-3.1-flash-live-preview', name: 'Gemini 3.1 Flash Live' },
    { id: 'gemini-3.5-live-translate-preview', name: 'Gemini 3.5 Live Translate' },
  ],
  PersonaPlex: [
    { id: 'personaplex-7b-v1-bnb-4bit', name: 'PersonaPlex 7B (Local Moshi)' },
  ],
  GLM4Voice: [
    { id: 'glm-4-voice-9b', name: 'GLM-4-Voice 9B S2S' },
  ],
}

export const VOICES_BY_PROVIDER: Record<string, Array<{ id: string; name: string }>> = {
  Cartesia: [
    { id: 'f786b574-daa5-4673-aa0c-cbe3e8534c02', name: 'Katie (自然灵动女声 - 推荐)' },
    { id: 'a0e99841-438c-4a64-b679-ae501e7d6091', name: 'Barbershop Man (磁性男声)' },
    { id: '79a125e8-cd45-4c13-8a67-188112f4dd22', name: 'British Lady (英音女声)' },
  ],
  DashScope: [
    { id: 'Tina', name: 'Tina (灵动女声 - 推荐)' },
    { id: 'Cindy', name: 'Cindy (甜美女声)' },
    { id: 'Liora Mira', name: 'Liora Mira (知性女声)' },
    { id: 'Serena', name: 'Serena (优雅女声)' },
    { id: 'Sunnybobi', name: 'Sunnybobi (阳光男声)' },
    { id: 'Raymond', name: 'Raymond (沉稳男声)' },
    { id: 'Ethan', name: 'Ethan (磁性男声)' },
    { id: 'Harvey', name: 'Harvey (成熟男声)' },
    { id: 'Gold', name: 'Gold (金牌播音)' },
    { id: 'Eric', name: 'Eric (活力男声)' },
    { id: 'longanqian', name: '龙安谦 (Qwen-Audio)' },
  ],
  Doubao: [
    { id: 'zh_female_vv_jupiter_bigtts', name: '璨璨 (Jupiter 智能女声)' },
    { id: 'zh_female_xiaohe_jupiter_bigtts', name: '小禾 (甜美台腔女声)' },
    { id: 'zh_male_yunzhou_jupiter_bigtts', name: '云舟 (清爽沉稳男声)' },
    { id: 'zh_female_sugarglider_bigtts', name: '蜜袋鼯 (元气女声)' },
    { id: 'zh_male_m14_bigtts', name: '阳光青年 (男声)' },
  ],
  OpenAI: [
    { id: 'alloy', name: 'Alloy' },
    { id: 'echo', name: 'Echo' },
    { id: 'shimmer', name: 'Shimmer' },
    { id: 'verse', name: 'Verse' },
  ],
  Google: [
    { id: 'Puck', name: 'Puck' },
    { id: 'Charon', name: 'Charon' },
    { id: 'Aoede', name: 'Aoede' },
    { id: 'Kore', name: 'Kore' },
    { id: 'Fenrir', name: 'Fenrir' },
  ],
  PersonaPlex: [
    { id: 'NATF2.pt', name: 'NATF2 (自然女声)' },
    { id: 'NATM0.pt', name: 'NATM0 (自然男声)' },
    { id: 'VARF0.pt', name: 'VARF0 (表现力女声)' },
    { id: 'VARM0.pt', name: 'VARM0 (表现力男声)' },
  ],
  GLM4Voice: [
    { id: 'default', name: 'GLM-4 默认音色' },
  ],
}

export const VoiceSettingsPopover: React.FC<VoiceSettingsPopoverProps> = ({
  options,
  onChange,
  onClose,
  t,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'voice' | 'credentials'>('voice')
  const [apiKeyInput, setApiKeyInput] = useState(options.apiKey || '')
  const [tokenInput, setTokenInput] = useState(options.token || '')
  const [gatewayInput, setGatewayInput] = useState(options.gatewayUrl || 'ws://127.0.0.1:8000/api/voice-chat/ws')
  const [savedSuccess, setSavedSuccess] = useState(false)

  const providerKey = options.provider || 'DashScope'
  const models = MODELS_BY_PROVIDER[providerKey] || []
  const voices = VOICES_BY_PROVIDER[providerKey] || []

  const handleClose = () => {
    setIsOpen(false)
    onClose?.()
  }

  const handleSaveCredentials = () => {
    onChange({
      apiKey: apiKeyInput.trim(),
      token: tokenInput.trim(),
      gatewayUrl: gatewayInput.trim(),
    })
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2000)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className={styles.actionBtn}
        onClick={() => setIsOpen(!isOpen)}
        title={t('settingsTitle')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={handleClose}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              right: 0,
              marginBottom: 10,
              width: 320,
              background: 'rgba(24, 27, 36, 0.98)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 14,
              padding: 16,
              boxShadow: '0 16px 40px rgba(0,0,0,0.65)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Header & Tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  style={{
                    background: activeTab === 'voice' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                    border: activeTab === 'voice' ? '1px solid #3b82f6' : '1px solid transparent',
                    color: activeTab === 'voice' ? '#93c5fd' : '#9ca3af',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  onClick={() => setActiveTab('voice')}
                >
                  {t('settingsTitle')}
                </button>
                <button
                  type="button"
                  style={{
                    background: activeTab === 'credentials' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                    border: activeTab === 'credentials' ? '1px solid #3b82f6' : '1px solid transparent',
                    color: activeTab === 'credentials' ? '#93c5fd' : '#9ca3af',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  onClick={() => setActiveTab('credentials')}
                >
                  API Key / Token
                </button>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16 }}
                onClick={handleClose}
              >
                ×
              </button>
            </div>

            {activeTab === 'voice' ? (
              <>
                {/* Provider */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: '#9ca3af' }}>{t('provider')}</label>
                  <select
                    value={options.provider || 'DashScope'}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 6,
                      color: '#e5e7eb',
                      padding: '6px 8px',
                      fontSize: 12,
                      outline: 'none',
                    }}
                    onChange={(e) => {
                      const p = e.target.value
                      const firstModel = MODELS_BY_PROVIDER[p]?.[0]?.id || 'default'
                      const firstVoice = VOICES_BY_PROVIDER[p]?.[0]?.id || 'default'
                      onChange({ provider: p, model: firstModel, voice: firstVoice })
                    }}
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id} style={{ background: '#1e212b' }}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: '#9ca3af' }}>模型引擎</label>
                  <select
                    value={options.model || models[0]?.id || 'qwen3.5-omni-plus-realtime'}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 6,
                      color: '#e5e7eb',
                      padding: '6px 8px',
                      fontSize: 12,
                      outline: 'none',
                    }}
                    onChange={(e) => onChange({ model: e.target.value })}
                  >
                    {models.map((m: { id: string; name: string }) => (
                      <option key={m.id} value={m.id} style={{ background: '#1e212b' }}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Voice */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: '#9ca3af' }}>{t('voice')}</label>
                  <select
                    value={options.voice || voices[0]?.id || 'Tina'}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 6,
                      color: '#e5e7eb',
                      padding: '6px 8px',
                      fontSize: 12,
                      outline: 'none',
                    }}
                    onChange={(e) => onChange({ voice: e.target.value })}
                  >
                    {voices.map((v: { id: string; name: string }) => (
                      <option key={v.id} value={v.id} style={{ background: '#1e212b' }}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* DashScope / Provider API Key */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: 11, color: '#9ca3af' }}>
                    {options.provider || 'DashScope'} API Key
                  </label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 6,
                      color: '#e5e7eb',
                      padding: '5px 8px',
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Gateway Token */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: 11, color: '#9ca3af' }}>
                    VoiceSpirit 鉴权 Token
                  </label>
                  <input
                    type="password"
                    placeholder="vsu.ey..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 6,
                      color: '#e5e7eb',
                      padding: '5px 8px',
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Gateway WS URL */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <label style={{ fontSize: 11, color: '#9ca3af' }}>
                    网关地址 (WebSocket)
                  </label>
                  <input
                    type="text"
                    value={gatewayInput}
                    onChange={(e) => setGatewayInput(e.target.value)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 6,
                      color: '#e5e7eb',
                      padding: '5px 8px',
                      fontSize: 11,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Save Button */}
                <button
                  type="button"
                  onClick={handleSaveCredentials}
                  style={{
                    marginTop: 4,
                    background: savedSuccess ? '#10b981' : '#2563eb',
                    border: 'none',
                    borderRadius: 6,
                    color: '#ffffff',
                    padding: '6px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {savedSuccess ? '✓ 已保存配置' : '保存 API Key 与凭证'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
