import { useEffect, useRef, useState } from 'react'

import { useI18n } from '@/i18n'
import { notify, notifyError } from '@/store/notifications'

import type { ComposerSendTarget, VoiceActivityState, VoiceStatus } from '../types'

import { useMicRecorder } from './use-mic-recorder'

interface VoiceRecorderOptions {
  maxRecordingSeconds: number
  onTranscribeAudio?: (audio: Blob) => Promise<string>
  focusInput: () => void
  /**
   * Snapshot the session this dictation belongs to, taken when the microphone
   * opens. Recording lasts as long as the user speaks and transcription adds
   * seconds more, so the composer can be showing a different session by the
   * time the transcript exists — and every closure rebuilt in between (the
   * hotkey handler, the mic button) carries that newer session. The pin is the
   * only identity taken while the user was still in the chat they meant to
   * talk to.
   */
  pinTarget?: () => ComposerSendTarget
  onTranscript: (text: string, target: ComposerSendTarget | null) => Promise<void> | void
}

export function useVoiceRecorder({
  maxRecordingSeconds,
  onTranscribeAudio,
  focusInput,
  pinTarget,
  onTranscript
}: VoiceRecorderOptions) {
  const { t } = useI18n()
  const voiceCopy = t.notifications.voice
  const { handle, level, recording } = useMicRecorder(voiceCopy)
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startedAtRef = useRef(0)
  const intervalRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)
  // The session this recording belongs to, taken at mic-open. Lives on a ref
  // because it must outlive every render between start and transcript.
  const pinnedTargetRef = useRef<ComposerSendTarget | null>(null)

  const clearTimers = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  useEffect(() => () => clearTimers(), [])

  const stop = async () => {
    clearTimers()
    // Read the pin BEFORE any await: this `stop` closure may itself be a newer
    // render's (the hotkey re-subscribes every render), so the ref — not this
    // scope — is what still knows where the dictation began.
    const pinnedTarget = pinnedTargetRef.current
    pinnedTargetRef.current = null
    const result = await handle.stop()

    if (!result) {
      setVoiceStatus('idle')

      return
    }

    if (!onTranscribeAudio) {
      setVoiceStatus('idle')

      return
    }

    setVoiceStatus('transcribing')

    try {
      const transcript = (await onTranscribeAudio(result.audio)).trim()

      if (!transcript) {
        notify({ kind: 'warning', title: voiceCopy.noSpeechDetected, message: voiceCopy.tryRecordingAgain })
      } else {
        await onTranscript(transcript, pinnedTarget)
      }
    } catch (error) {
      notifyError(error, voiceCopy.transcriptionFailed)
    } finally {
      setVoiceStatus('idle')
      focusInput()
    }
  }

  const start = async () => {
    if (!onTranscribeAudio) {
      notify({ kind: 'warning', title: voiceCopy.unavailable, message: voiceCopy.transcriptionUnavailable })

      return
    }

    // Pin the session before the mic opens, not when it closes.
    pinnedTargetRef.current = pinTarget?.() ?? null

    try {
      await handle.start({ onError: error => notifyError(error, voiceCopy.recordingFailed) })
      startedAtRef.current = Date.now()
      setElapsedSeconds(0)
      setVoiceStatus('recording')
      intervalRef.current = window.setInterval(() => setElapsedSeconds((Date.now() - startedAtRef.current) / 1000), 250)
      const cap = Math.max(1, Math.min(Math.trunc(maxRecordingSeconds), 600))
      timeoutRef.current = window.setTimeout(() => void stop(), cap * 1000)
    } catch (error) {
      pinnedTargetRef.current = null
      setVoiceStatus('idle')
      notifyError(error, voiceCopy.recordingFailed)
    }
  }

  const dictate = () => {
    if (recording) {
      void stop()
    } else if (voiceStatus === 'idle') {
      void start()
    }
  }

  const voiceActivityState: VoiceActivityState = {
    elapsedSeconds,
    level,
    status: voiceStatus
  }

  return { dictate, voiceActivityState, voiceStatus }
}
