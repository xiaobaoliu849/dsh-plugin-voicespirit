import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** Actions the plugin injects into its slot components. */
export interface VoiceSpiritInjectedActions {
  startCall: () => void
  endCall: () => void
  toggleMute: () => void
  interrupt?: () => void
  openSettings?: () => void
  toggleImmersive?: () => void
  isCallActive: boolean
  isMuted: boolean
}

/** Props the composer mic button receives from its slot registration. */
export type VoiceCallComposerButtonProps = PropsRuntime<'conversation.input.right'>
  & PropsLocale<'voicespirit'> & {
    actions?: VoiceSpiritInjectedActions
  }
