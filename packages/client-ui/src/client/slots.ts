import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

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

export type VoiceCallButtonProps = PropsRuntime<'conversation.session.header.actions'> & {
  actions?: VoiceSpiritInjectedActions
}

export type VoiceCallComposerButtonProps = PropsRuntime<'conversation.input.right'> & {
  actions?: VoiceSpiritInjectedActions
}
