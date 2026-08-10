import type { ReactNode } from 'react'

import type { SubmitTextOptions } from '@/app/session/hooks/use-prompt-actions/utils'
import type { HermesGateway } from '@/hermes'

import type { DroppedFile } from '../hooks/use-composer-actions'

export interface ContextSuggestion {
  text: string
  display: string
  meta?: string
}

export interface QuickModelOption {
  provider: string
  providerName: string
  model: string
}

export interface ChatBarState {
  model: {
    model: string
    provider: string
    canSwitch: boolean
    loading?: boolean
    quickModels?: QuickModelOption[]
    /** Reused status-bar dropdown (built with gateway + selectModel upstream). */
    modelMenuContent?: ReactNode
  }
  tools: { enabled: boolean; label: string; suggestions?: ContextSuggestion[] }
  voice: { enabled: boolean; active: boolean }
}

export interface ChatBarProps {
  busy: boolean
  disabled: boolean
  focusKey?: string | null
  maxRecordingSeconds?: number
  state: ChatBarState
  gateway?: HermesGateway | null
  queueSessionKey?: string | null
  sessionId?: string | null
  storedSessionId?: string | null
  cwd?: string | null
  onCancel: () => Promise<void> | void
  onAddContextRef?: (refText: string, label?: string, detail?: string) => void
  onAddUrl?: (url: string) => void
  onAttachImageBlob?: (blob: Blob) => Promise<boolean | void> | boolean | void
  onAttachDroppedItems?: (candidates: DroppedFile[]) => Promise<boolean | void> | boolean | void
  onPasteClipboardImage?: (opts?: { silent?: boolean }) => Promise<boolean> | void
  onPickFiles?: () => void
  onPickFolders?: () => void
  onPickImages?: () => void
  onRemoveAttachment?: (id: string) => void
  onSteer?: (text: string) => Promise<boolean> | boolean
  onSubmit: (value: string, options?: SubmitTextOptions) => Promise<boolean> | boolean
  onTranscribeAudio?: (audio: Blob) => Promise<string>
}

/**
 * The three session identities a send is bound to, captured together at one
 * instant. Dictation is the reason this exists: recording and transcription
 * both outlive the render that started them, so the target must be pinned when
 * the microphone opens and carried through to the submit — reading any of the
 * three off live props at send time lands the words in whatever session the
 * user happens to be looking at by then.
 */
export interface ComposerSendTarget {
  /** Draft/queue scope key — the composer's own session identity. */
  composerScope: string | null
  /** Runtime session id (gateway streaming identity). */
  sessionId: string | null | undefined
  /** Durable stored session id. */
  storedSessionId: string | null | undefined
}

export type VoiceStatus = 'idle' | 'recording' | 'transcribing'

export interface VoiceActivityState {
  elapsedSeconds: number
  level: number
  status: VoiceStatus
}
