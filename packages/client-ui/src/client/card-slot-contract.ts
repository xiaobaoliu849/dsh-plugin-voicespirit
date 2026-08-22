/**
 * Type-only edge to the slot declaration this package's settings card
 * registers into. The `settings.plugin.item` SlotMap entry lives with its
 * declarer (`dsh-client-ui-settings-plugins`); importing its client face here
 * (types only — the purity gate forbids value imports) makes the keyed slot
 * visible to `PropsRuntime<'settings.plugin.item'>` in this package's program.
 */
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
