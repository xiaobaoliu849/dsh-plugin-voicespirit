/**
 * VoiceSpirit Host Service: provides gateway status, health check and configuration.
 */
import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'

export interface VoiceSpiritGatewayConfig {
  gatewayUrl: string
  defaultProvider: string
  defaultModel: string
  defaultVoice: string
}

export class VoiceSpiritService extends Service {
  private config: VoiceSpiritGatewayConfig = {
    gatewayUrl: 'ws://127.0.0.1:8000/voice-chat/ws',
    defaultProvider: 'DashScope',
    defaultModel: 'qwen-omni-turbo-realtime',
    defaultVoice: 'Tina',
  }

  constructor(ctx: Context) {
    super(ctx, 'voiceSpirit')
  }

  public getConfig(): VoiceSpiritGatewayConfig {
    return { ...this.config }
  }

  public setConfig(update: Partial<VoiceSpiritGatewayConfig>): void {
    this.config = { ...this.config, ...update }
  }

  public async checkHealth(): Promise<{ ok: boolean; message?: string }> {
    try {
      const httpUrl = this.config.gatewayUrl.replace(/^ws/, 'http').replace(/\/ws$/, '')
      const res = await fetch(`${httpUrl}/health`, { method: 'GET', signal: AbortSignal.timeout(3000) })
      return { ok: res.ok, message: `Status: ${res.status}` }
    } catch (e: any) {
      return { ok: false, message: e.message || 'Service unreachable' }
    }
  }
}
