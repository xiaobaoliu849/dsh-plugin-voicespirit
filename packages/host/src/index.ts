import type { Context } from '@deepseek-ai/cordis'
import { VoiceSpiritService } from './service.js'

export { VoiceSpiritService } from './service.js'

declare module '@deepseek-ai/cordis' {
  interface Context {
    voiceSpirit: VoiceSpiritService
  }
}

export function apply(ctx: Context): void {
  ctx.plugin(VoiceSpiritService)
}
