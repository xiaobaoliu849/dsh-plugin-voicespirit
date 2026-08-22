/**
 * VoiceSpirit Realtime Voice Plugin Client Assembly
 * Deeply integrates realtime duplex voice conversations with DeepSeek Harness design language.
 *
 * One controller owns the audio engine, the backend status client, and the
 * harness settings scope; every surface (composer mic button, call dock,
 * quick settings popover, settings card) reads through it, so provider,
 * credentials, and backend phase can never disagree between them.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { VoiceSettingsCard } from './components/VoiceSettingsCard.tsx'
import { VoiceCallHeaderButton } from './components/VoiceCallButton.tsx'
import { VoiceCallDockView } from './components/VoiceCallDockView.tsx'
import { en, zh, type VoiceSpiritKey } from './locales.ts'
import { VoiceSettingsCardController, VOICESPIRIT_SETTINGS_NAMESPACE } from './voice-card-controller.ts'
import { VoiceSpiritController } from './voice-controller.ts'
import type { VoiceSpiritSettings } from './contract/settings.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    voicespirit: VoiceSpiritKey
  }
}

const NS = 'voicespirit'

export const inject = ['slots', 'locale', 'settingsScope']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-voicespirit: dictionaries')
  const t = ctx.locale.bind(NS)

  const scope = ctx.settingsScope.bind<VoiceSpiritSettings>({ namespace: VOICESPIRIT_SETTINGS_NAMESPACE })
  const controller = new VoiceSpiritController(scope)
  ctx.effect(
    () => {
      controller.startMonitoring()
      return () => { controller.stopMonitoring() }
    },
    'ui-voicespirit: backend status polling',
  )
  const card = new VoiceSettingsCardController(scope, controller.getBackendClient())

  // 1. Composer mic button (bottom-right of the input toolbar)
  ctx.slots.inject(
    'conversation.input.right',
    () =>
      ctx.slots.register(
        {
          name: 'conversation.input.right',
          id: 'ui-voicespirit:mic-btn',
          order: 90,
          locale: NS,
          inject: () => {
            const snapshot = controller.getSnapshot()
            return {
              t,
              actions: {
                startCall: () => { void controller.startCall() },
                endCall: () => { controller.endCall() },
                toggleMute: () => { controller.toggleMute() },
                interrupt: () => { controller.interrupt() },
                toggleImmersive: () => { controller.toggleImmersive() },
                // An errored session reads as "not in a call": the next mic
                // click starts a fresh attempt instead of hanging up.
                isCallActive: snapshot.engine.phase !== 'idle' && snapshot.engine.phase !== 'error',
                isMuted: snapshot.engine.isMuted,
              },
            }
          },
        },
        VoiceCallHeaderButton,
      ),
  )

  // 2. VoiceSpirit integrated stage (Ribbon + Controls + Hangup)
  //    stacked above the composer, plus the immersive full-screen view.
  ctx.slots.inject(
    'conversation.input.dock',
    () =>
      ctx.slots.register(
        {
          name: 'conversation.input.dock',
          id: 'ui-voicespirit:dock',
          order: 10,
          locale: NS,
          inject: (ownerProps: Record<string, unknown>) => ({ controller, t, ...ownerProps }),
        },
        VoiceCallDockView,
      ),
  )

  // 3. The plugin card in Settings → Plugins: backend lifecycle, provider
  //    selection, and the selected provider's credentials.
  ctx.slots.inject('settings.plugin.item', function* () {
    yield ctx.slots.register({
      name: 'settings.plugin.item',
      key: VOICESPIRIT_SETTINGS_NAMESPACE,
      locale: NS,
      inject: () => card.inject(),
    }, VoiceSettingsCard)
  })
}
