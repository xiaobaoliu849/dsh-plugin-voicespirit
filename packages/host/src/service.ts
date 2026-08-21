/**
 * VoiceSpirit host service: the backend lifecycle plus the resolved settings
 * namespace, shared by the HTTP routes and the realtime proxy.
 */

import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import { VoiceSpiritGateway } from './gateway.ts'
import {
  DEFAULT_VOICESPIRIT_SETTINGS,
  VOICESPIRIT_NAMESPACE,
  type VoiceSpiritSettings,
} from './settings.ts'

export class VoiceSpiritService extends Service {
  private readonly gateway: VoiceSpiritGateway

  constructor(ctx: Context) {
    super(ctx, 'voiceSpirit')
    this.gateway = new VoiceSpiritGateway(ctx.logger, () => this.settings)
  }

  /** The backend lifecycle + proxy face the routes compose over. */
  get gatewayFace(): VoiceSpiritGateway {
    return this.gateway
  }

  /** The resolved settings section (schema defaults under the user layer). */
  get settings(): VoiceSpiritSettings {
    const settings = this.ctx.get('settings')
    if (settings === undefined) return DEFAULT_VOICESPIRIT_SETTINGS
    return (settings.get(VOICESPIRIT_NAMESPACE) as VoiceSpiritSettings | undefined)
      ?? DEFAULT_VOICESPIRIT_SETTINGS
  }

  protected async [Service.init](): Promise<void> {
    // Launch-on-boot when composed: the probe is cheap and a spawn runs in the
    // background, so boot never waits on the Python interpreter.
    if (this.settings.autoStart) {
      void this.gateway.start().catch((error: unknown) => {
        this.ctx.logger.warn(error instanceof Error ? error : new Error(String(error)))
      })
    }
    // Only a backend this service spawned is this service's to stop.
    this.ctx.effect(() => async () => {
      await this.gateway.dispose()
    }, 'host-voicespirit: backend teardown')
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    voiceSpirit: VoiceSpiritService
  }
}
