/**
 * Rich Voice Catalog definition and built-in metadata for VoiceSpirit
 * Provides human-readable names, gender, language tags, and descriptions
 * for supported providers.
 */

export type VoiceGender = 'female' | 'male' | 'neutral'

export interface VoiceCatalogEntry {
  /** Voice identifier sent over WebSocket handshake */
  id: string
  /** English display name */
  displayName: string
  /** Chinese display name */
  displayNameZh: string
  /** Voice gender */
  gender: VoiceGender
  /** Primary language */
  language: string
  /** Style/personality tags */
  tags: string[]
  /** Brief description */
  description?: string
  descriptionZh?: string
}

export const DASHSCOPE_VOICES: readonly VoiceCatalogEntry[] = [
  {
    id: 'Cherry',
    displayName: 'Cherry',
    displayNameZh: '樱桃 (温柔知性)',
    gender: 'female',
    language: 'zh/en',
    tags: ['温柔', '知性', '自然'],
    description: 'Gentle, natural female voice suited for daily chat.',
    descriptionZh: '温柔自然的女声，语调柔和亲切，适合日常陪伴与交流。',
  },
  {
    id: 'Ethan',
    displayName: 'Ethan',
    displayNameZh: '伊森 (沉稳磁性)',
    gender: 'male',
    language: 'zh/en',
    tags: ['沉稳', '磁性', '商务'],
    description: 'Calm, deep male voice suited for professional dialogue.',
    descriptionZh: '沉稳大气的男声，声音磁性专业，适合助手与商务场景。',
  },
  {
    id: 'Tina',
    displayName: 'Tina',
    displayNameZh: '蒂娜 (活泼明快)',
    gender: 'female',
    language: 'zh/en',
    tags: ['活泼', '明快', '元气'],
    description: 'Lively, clear female voice full of energy.',
    descriptionZh: '活泼元气的年轻女声，语速轻快，适合轻松愉悦的互动。',
  },
  {
    id: 'Chelsie',
    displayName: 'Chelsie',
    displayNameZh: '切尔茜 (亲切甜美)',
    gender: 'female',
    language: 'zh/en',
    tags: ['甜美', '亲切', '治愈'],
    description: 'Sweet, friendly female voice.',
    descriptionZh: '甜美亲切的少女音，治愈感十足。',
  },
  {
    id: 'Dylan',
    displayName: 'Dylan',
    displayNameZh: '迪伦 (阳光青年)',
    gender: 'male',
    language: 'zh/en',
    tags: ['阳光', '清亮', '青年'],
    description: 'Bright and energetic young male voice.',
    descriptionZh: '阳光开朗的青年男声，清晰有力。',
  },
  {
    id: 'Jada',
    displayName: 'Jada',
    displayNameZh: '杰达 (从容干练)',
    gender: 'female',
    language: 'zh/en',
    tags: ['从容', '干练', '职场'],
    description: 'Composed professional female tone.',
    descriptionZh: '从容自信的干练女声，清晰沉着。',
  },
  {
    id: 'Sunshine',
    displayName: 'Sunshine',
    displayNameZh: '阳光 (朝气蓬勃)',
    gender: 'female',
    language: 'zh/en',
    tags: ['朝气', '温暖', '儿童'],
    description: 'Warm and sunny child-friendly tone.',
    descriptionZh: '温暖朝气的声音，充满亲和力。',
  },
  {
    id: 'Serena',
    displayName: 'Serena',
    displayNameZh: '塞雷娜 (优雅从容)',
    gender: 'female',
    language: 'zh/en',
    tags: ['优雅', '沉静', '叙事'],
    description: 'Elegant storytelling voice.',
    descriptionZh: '优雅端庄的女声，适合阅读与长文本解说。',
  },
]

export const GOOGLE_VOICES: readonly VoiceCatalogEntry[] = [
  {
    id: 'Puck',
    displayName: 'Puck',
    displayNameZh: '帕克 (清亮灵动)',
    gender: 'male',
    language: 'en/multi',
    tags: ['灵动', '清脆', '幽默'],
    description: 'Playful, expressive voice.',
    descriptionZh: '灵动生动的声线，表现力丰富。',
  },
  {
    id: 'Charon',
    displayName: 'Charon',
    displayNameZh: '卡戎 (深邃低沉)',
    gender: 'male',
    language: 'en/multi',
    tags: ['低沉', '权威', '严肃'],
    description: 'Deep authoritative voice.',
    descriptionZh: '深沉低厚的声音，沉着稳重。',
  },
  {
    id: 'Kore',
    displayName: 'Kore',
    displayNameZh: '科尔 (轻柔温暖)',
    gender: 'female',
    language: 'en/multi',
    tags: ['温暖', '柔和', '舒缓'],
    description: 'Gentle, soothing tone.',
    descriptionZh: '温和轻柔的女声，带来舒适的聆听体验。',
  },
  {
    id: 'Fenrir',
    displayName: 'Fenrir',
    displayNameZh: '芬里尔 (坚定有力)',
    gender: 'male',
    language: 'en/multi',
    tags: ['有力', '坚定', '果断'],
    description: 'Strong, determined voice.',
    descriptionZh: '坚定有力的男声，掷地有声。',
  },
  {
    id: 'Aoede',
    displayName: 'Aoede',
    displayNameZh: '奥埃德 (优美悦耳)',
    gender: 'female',
    language: 'en/multi',
    tags: ['悦耳', '优雅', '自然'],
    description: 'Melodic, pleasant voice.',
    descriptionZh: '宛转优美的声调，自然动听。',
  },
]

export const OPENAI_VOICES: readonly VoiceCatalogEntry[] = [
  {
    id: 'alloy',
    displayName: 'Alloy',
    displayNameZh: 'Alloy (平衡中性)',
    gender: 'neutral',
    language: 'multi',
    tags: ['平衡', '现代', '清晰'],
    description: 'Versatile and balanced voice.',
    descriptionZh: '质感通透、中性现代，适合各类场景。',
  },
  {
    id: 'echo',
    displayName: 'Echo',
    displayNameZh: 'Echo (沉稳男中音)',
    gender: 'male',
    language: 'multi',
    tags: ['温和', '男中音', '叙事'],
    description: 'Warm and steady baritone.',
    descriptionZh: '温暖平稳的男中音，极具安全感。',
  },
  {
    id: 'shimmer',
    displayName: 'Shimmer',
    displayNameZh: 'Shimmer (明朗女声)',
    gender: 'female',
    language: 'multi',
    tags: ['明朗', '清脆', '富有表现力'],
    description: 'Expressive and clear tone.',
    descriptionZh: '清脆明亮的女声，情感细腻。',
  },
  {
    id: 'marin',
    displayName: 'Marin',
    displayNameZh: 'Marin (从容自信)',
    gender: 'female',
    language: 'multi',
    tags: ['从容', '自信', '专业'],
    description: 'Calm, confident tone.',
    descriptionZh: '从容自信的声线，现代感强。',
  },
  {
    id: 'cedar',
    displayName: 'Cedar',
    displayNameZh: 'Cedar (厚重温暖)',
    gender: 'male',
    language: 'multi',
    tags: ['厚重', '温暖', '亲切'],
    description: 'Rich, comforting male voice.',
    descriptionZh: '厚重温暖的男声，娓娓道来。',
  },
]

export const DOUBAO_VOICES: readonly VoiceCatalogEntry[] = [
  {
    id: 'zh_female_vv_jupiter_bigtts',
    displayName: 'VV (Jupiter)',
    displayNameZh: '灿灿 (知性亲和女声)',
    gender: 'female',
    language: 'zh',
    tags: ['亲和', '知性', '高音质'],
    description: 'Flagship high-fidelity female voice.',
    descriptionZh: '旗舰级高清女声，咬字清晰，自然流畅。',
  },
  {
    id: 'zh_female_cancan_mars_bigtts',
    displayName: 'Cancan (Mars)',
    displayNameZh: '灿灿 (活泼灵动女声)',
    gender: 'female',
    language: 'zh',
    tags: ['活泼', '灵动', '少女'],
    description: 'Bright and energetic female voice.',
    descriptionZh: '活泼轻灵的少女音，生动自然。',
  },
  {
    id: 'zh_male_rouwanwan_mars_bigtts',
    displayName: 'Rouwanwan (Mars)',
    displayNameZh: '肉丸丸 (可爱萌趣男声)',
    gender: 'male',
    language: 'zh',
    tags: ['可爱', '萌趣', '亲切'],
    description: 'Cute, playful male persona.',
    descriptionZh: '亲切可爱的声音，陪伴感强。',
  },
  {
    id: 'zh_female_rouse_jupiter_bigtts',
    displayName: 'Rouse (Jupiter)',
    displayNameZh: '柔丝 (温润治愈女声)',
    gender: 'female',
    language: 'zh',
    tags: ['温润', '治愈', '舒缓'],
    description: 'Gentle, soothing tone.',
    descriptionZh: '柔和温润的声线，适合夜间与放松。',
  },
]

export const CARTESIA_VOICES: readonly VoiceCatalogEntry[] = [
  {
    id: 'f786b574-daa5-4673-aa0c-cbe3e8534c02',
    displayName: 'Sonic (Default)',
    displayNameZh: 'Sonic (默认自然音色)',
    gender: 'neutral',
    language: 'en/multi',
    tags: ['超低延迟', '自然', '流畅'],
    description: 'Ultra-low latency realtime voice.',
    descriptionZh: '超低延迟自然发音，适合高速实时对话。',
  },
]

export const PERSONAPLEX_VOICES: readonly VoiceCatalogEntry[] = [
  {
    id: 'NATF2.pt',
    displayName: 'NATF2',
    displayNameZh: 'NATF2 (本地自然女声)',
    gender: 'female',
    language: 'multi',
    tags: ['本地', '离线', '端侧'],
    description: 'Local on-device female voice model.',
    descriptionZh: '端侧本地运行的自然女声音色。',
  },
  {
    id: 'NATF0.pt',
    displayName: 'NATF0',
    displayNameZh: 'NATF0 (清晰女声)',
    gender: 'female',
    language: 'multi',
    tags: ['本地', '清脆'],
    description: 'Local on-device female voice model.',
    descriptionZh: '端侧本地清晰女声音色。',
  },
  {
    id: 'VARM4.pt',
    displayName: 'VARM4',
    displayNameZh: 'VARM4 (自然男声)',
    gender: 'male',
    language: 'multi',
    tags: ['本地', '男声'],
    description: 'Local on-device male voice model.',
    descriptionZh: '端侧本地自然男声音色。',
  },
]

export const GLM4VOICE_VOICES: readonly VoiceCatalogEntry[] = [
  {
    id: 'default',
    displayName: 'Default',
    displayNameZh: '智谱默认 (全双工端到端)',
    gender: 'female',
    language: 'zh/en',
    tags: ['端到端', '情感丰富', '全双工'],
    description: 'GLM-4-Voice native end-to-end voice.',
    descriptionZh: 'GLM-4-Voice 原生端到端情感拟真音色。',
  },
]

export const PROVIDER_VOICE_MAP: Record<string, readonly VoiceCatalogEntry[]> = {
  DashScope: DASHSCOPE_VOICES,
  Google: GOOGLE_VOICES,
  OpenAI: OPENAI_VOICES,
  Doubao: DOUBAO_VOICES,
  Cartesia: CARTESIA_VOICES,
  PersonaPlex: PERSONAPLEX_VOICES,
  GLM4Voice: GLM4VOICE_VOICES,
}

/** Get rich voice catalog for a provider with safe fallback */
export function getProviderVoices(provider: string | undefined): readonly VoiceCatalogEntry[] {
  if (!provider || provider.trim() === '') return DASHSCOPE_VOICES
  const normalized = provider.toLowerCase().replace(/[-_]/g, '')
  const matchedKey = Object.keys(PROVIDER_VOICE_MAP).find(
    k => k.toLowerCase().replace(/[-_]/g, '') === normalized
  )
  if (matchedKey && PROVIDER_VOICE_MAP[matchedKey]?.length) {
    return PROVIDER_VOICE_MAP[matchedKey]
  }
  return DASHSCOPE_VOICES
}
