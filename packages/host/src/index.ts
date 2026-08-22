/**
 * @deepseek-ai/dsh-host-voicespirit — harness-side bridge for the VoiceSpirit
 * realtime voice backend: launches the FastAPI gateway as a managed child
 * process, registers browser routes under /api/voicespirit (status, backend
 * start/stop, settings and model proxy, log tail), and pipes the realtime
 * voice-chat WebSocket through so the browser never talks cross-origin or
 * holds a credential.
 * @module @deepseek-ai/dsh-host-voicespirit
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { registerVoiceSpiritRoutes } from './routes.ts'
import {
  VOICESPIRIT_NAMESPACE,
  VoiceSpiritSettingsSchema,
} from './settings.ts'
import { VoiceSpiritService } from './service.ts'

export {
  VOICESPIRIT_NAMESPACE, VOICESPIRIT_PROVIDERS, VOICESPIRIT_SETTINGS_NAMESPACE,
  VoiceSpiritSettingsSchema, type VoiceSpiritSettings,
} from './settings.ts'
export { VoiceSpiritGateway, type GatewayStatus } from './gateway.ts'
export { VoiceSpiritService } from './service.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    voiceSpirit: VoiceSpiritService
  }
}

/** Host services this plugin requires before it can compose. */
export const inject = ['settings', 'webServer']

/**
 * Register the settings namespace, the lifecycle service, and the browser routes.
 * @param ctx - host plugin context.
 */
export function apply(ctx: Context): void {
  ctx.settings.register(VOICESPIRIT_NAMESPACE, VoiceSpiritSettingsSchema)
  ctx.plugin(VoiceSpiritService)
  ctx.inject(['voiceSpirit'], (serviceCtx) => {
    registerVoiceSpiritRoutes(serviceCtx, serviceCtx.voiceSpirit.gatewayFace)
  })
}
