import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MicRecording } from './use-mic-recorder'
import { useVoiceRecorder } from './use-voice-recorder'

let recording = false

const micHandle = {
  cancel: vi.fn(),
  start: vi.fn(async () => {
    recording = true
  }),
  stop: vi.fn<() => Promise<MicRecording | null>>(async () => {
    recording = false

    return {
      audio: new Blob(['audio'], { type: 'audio/webm' }),
      durationMs: 1_000,
      heardSpeech: true
    }
  })
}

vi.mock('./use-mic-recorder', () => ({
  useMicRecorder: () => ({ handle: micHandle, level: 0.4, recording })
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      notifications: {
        voice: {
          noSpeechDetected: 'No speech detected',
          recordingFailed: 'Recording failed',
          transcriptionFailed: 'Transcription failed',
          transcriptionUnavailable: 'Transcription unavailable',
          tryRecordingAgain: 'Try recording again',
          unavailable: 'Unavailable'
        }
      }
    }
  })
}))

vi.mock('@/store/notifications', () => ({
  notify: vi.fn(),
  notifyError: vi.fn()
}))

describe('useVoiceRecorder', () => {
  beforeEach(() => {
    recording = false
    vi.clearAllMocks()
  })

  afterEach(() => cleanup())

  it('waits for delayed transcription, then hands the transcript to the submit callback', async () => {
    let resolveTranscription: ((text: string) => void) | undefined

    const onTranscribeAudio = vi.fn(
      () =>
        new Promise<string>(resolve => {
          resolveTranscription = resolve
        })
    )

    const onTranscript = vi.fn()
    const focusInput = vi.fn()

    const hook = renderHook(() =>
      useVoiceRecorder({
        focusInput,
        maxRecordingSeconds: 120,
        onTranscript,
        onTranscribeAudio
      })
    )

    await act(async () => hook.result.current.dictate())
    await waitFor(() => expect(hook.result.current.voiceStatus).toBe('recording'))

    act(() => hook.result.current.dictate())
    await waitFor(() => expect(hook.result.current.voiceStatus).toBe('transcribing'))

    expect(onTranscript).not.toHaveBeenCalled()

    await act(async () => resolveTranscription?.('  ship this automatically  '))

    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('ship this automatically', null))
    expect(hook.result.current.voiceStatus).toBe('idle')
    expect(focusInput).toHaveBeenCalled()
  })

  it('pins the transcript to the session captured when recording started, not when it stopped', async () => {
    const onTranscribeAudio = vi.fn(async () => 'dictated in X')
    const onTranscript = vi.fn()

    const hook = renderHook(
      ({ scope }: { scope: string }) =>
        useVoiceRecorder({
          focusInput: vi.fn(),
          maxRecordingSeconds: 120,
          onTranscript,
          onTranscribeAudio,
          // The real composer rebuilds this every render, reading whichever
          // session is loaded at that moment.
          pinTarget: () => ({ composerScope: scope, sessionId: `runtime-${scope}`, storedSessionId: scope })
        }),
      { initialProps: { scope: 'session-x' } }
    )

    await act(async () => hook.result.current.dictate())
    await waitFor(() => expect(hook.result.current.voiceStatus).toBe('recording'))

    // The user switches tabs WHILE STILL SPEAKING, then stops the recording
    // from session Y. The words were meant for X.
    hook.rerender({ scope: 'session-y' })

    await act(async () => hook.result.current.dictate())

    await waitFor(() =>
      expect(onTranscript).toHaveBeenCalledWith('dictated in X', {
        composerScope: 'session-x',
        sessionId: 'runtime-session-x',
        storedSessionId: 'session-x'
      })
    )
  })

  it('does not carry a finished dictation pin into the next recording', async () => {
    const onTranscribeAudio = vi.fn(async () => 'second take')
    const onTranscript = vi.fn()
    let scope = 'session-x'

    const hook = renderHook(() =>
      useVoiceRecorder({
        focusInput: vi.fn(),
        maxRecordingSeconds: 120,
        onTranscript,
        onTranscribeAudio,
        pinTarget: () => ({ composerScope: scope, sessionId: `runtime-${scope}`, storedSessionId: scope })
      })
    )

    await act(async () => hook.result.current.dictate())
    await act(async () => hook.result.current.dictate())
    await waitFor(() => expect(onTranscript).toHaveBeenCalledTimes(1))

    scope = 'session-y'
    await act(async () => hook.result.current.dictate())
    await act(async () => hook.result.current.dictate())

    await waitFor(() => expect(onTranscript).toHaveBeenCalledTimes(2))
    expect(onTranscript).toHaveBeenLastCalledWith('second take', {
      composerScope: 'session-y',
      sessionId: 'runtime-session-y',
      storedSessionId: 'session-y'
    })
  })
})
