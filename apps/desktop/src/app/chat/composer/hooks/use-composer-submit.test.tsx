import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { $clarifyRequests } from '@/store/clarify'
import { clearSessionDraft, type ComposerAttachment, stashSessionDraft } from '@/store/composer'
import { $gateway } from '@/store/gateway'

import { useComposerSubmit } from './use-composer-submit'

interface SubmitHarnessOptions {
  attachments?: ComposerAttachment[]
  busy?: boolean
  compacting?: boolean
  sessionId?: string
  storedSessionId?: string
  text?: string
}

function renderSubmitHook({
  attachments = [],
  busy = false,
  compacting = false,
  sessionId = 'runtime-session',
  storedSessionId = 'stored-session',
  text = ''
}: SubmitHarnessOptions = {}) {
  const draftRef = { current: text }
  const editor = globalThis.document.createElement('div')
  editor.dataset.slot = 'composer-rich-input'
  editor.textContent = text
  const editorRef = { current: editor }
  const onCancel = vi.fn()
  const onSteer = vi.fn(async () => true)
  const onSubmit = vi.fn(async () => true)
  const queueCurrentDraft = vi.fn(() => true)
  const activeQueueSessionKeyRef = { current: storedSessionId }
  const loadIntoComposer = vi.fn()
  const stashAt = vi.fn()

  const clearDraft = vi.fn(() => {
    draftRef.current = ''
    editorRef.current!.textContent = ''
  })

  const hook = renderHook(() =>
    useComposerSubmit({
      activeQueueSessionKey: storedSessionId,
      activeQueueSessionKeyRef,
      attachments,
      busy,
      compacting,
      clearDraft,
      disabled: false,
      draftRef,
      drainNextQueued: vi.fn(async () => false),
      editorRef,
      exitQueuedEdit: vi.fn(() => false),
      focusInput: vi.fn(),
      inputDisabled: false,
      loadIntoComposer,
      onCancel,
      onSteer,
      onSubmit,
      queueCurrentDraft,
      queueEdit: null,
      queuedPrompts: [],
      sessionId,
      storedSessionId,
      setComposerText: vi.fn(),
      stashAt
    })
  )

  return {
    activeQueueSessionKeyRef,
    clearDraft,
    hook,
    loadIntoComposer,
    onCancel,
    onSteer,
    onSubmit,
    queueCurrentDraft,
    stashAt
  }
}

describe('useComposerSubmit busy-turn routing', () => {
  afterEach(() => {
    cleanup()
    clearSessionDraft('stored-session-x')
    vi.restoreAllMocks()
  })

  it('steers a plain-text follow-up instead of queueing or stopping', async () => {
    const { hook, onCancel, onSteer, onSubmit, queueCurrentDraft } = renderSubmitHook({
      busy: true,
      text: 'change course'
    })

    act(() => {
      hook.result.current.submitDraft()
    })

    await waitFor(() => expect(onSteer).toHaveBeenCalledWith('change course'))
    expect(queueCurrentDraft).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('queues a plain-text follow-up while the active turn is compacting', () => {
    const { hook, onCancel, onSteer, onSubmit, queueCurrentDraft } = renderSubmitHook({
      busy: true,
      compacting: true,
      text: 'wait for the summary'
    })

    act(() => {
      hook.result.current.submitDraft()
    })

    expect(queueCurrentDraft).toHaveBeenCalledTimes(1)
    expect(onSteer).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('runs slash commands immediately while busy', async () => {
    const { clearDraft, hook, onCancel, onSteer, onSubmit, queueCurrentDraft } = renderSubmitHook({
      busy: true,
      text: '/compress preserve context'
    })

    act(() => {
      hook.result.current.submitDraft()
    })

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('/compress preserve context', {
        composerScope: 'stored-session',
        sessionId: 'runtime-session',
        storedSessionId: 'stored-session'
      })
    )
    expect(clearDraft).toHaveBeenCalledTimes(1)
    expect(onSteer).not.toHaveBeenCalled()
    expect(queueCurrentDraft).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('queues an attachment-bearing follow-up while busy', () => {
    const attachment: ComposerAttachment = { id: 'doc', kind: 'file', label: 'notes.txt' }

    const { hook, onCancel, onSteer, onSubmit, queueCurrentDraft } = renderSubmitHook({
      attachments: [attachment],
      busy: true,
      text: 'read this'
    })

    act(() => {
      hook.result.current.submitDraft()
    })

    expect(queueCurrentDraft).toHaveBeenCalledTimes(1)
    expect(onSteer).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('stops an active turn only with an empty composer', () => {
    const { hook, onCancel, onSteer, onSubmit, queueCurrentDraft } = renderSubmitHook({ busy: true })

    act(() => {
      hook.result.current.submitDraft()
    })

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSteer).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(queueCurrentDraft).not.toHaveBeenCalled()
  })

  it('submits a normal turn while idle', async () => {
    const { hook, onCancel, onSteer, onSubmit, queueCurrentDraft } = renderSubmitHook({ text: 'ordinary question' })

    act(() => {
      hook.result.current.submitDraft()
    })

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('ordinary question', {
        attachments: [],
        composerScope: 'stored-session',
        sessionId: 'runtime-session',
        storedSessionId: 'stored-session'
      })
    )
    expect(onSteer).not.toHaveBeenCalled()
    expect(queueCurrentDraft).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('threads the loaded composer scope through onSubmit for the #59305 submit-time guard', async () => {
    const { hook, onSubmit } = renderSubmitHook({ text: 'hello' })

    act(() => {
      hook.result.current.submitDraft()
    })

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('hello', expect.objectContaining({ composerScope: 'stored-session' }))
    )
  })

  it('pins a delayed submit to the session that owned the composer before a tab switch', async () => {
    const { activeQueueSessionKeyRef, hook, onSubmit } = renderSubmitHook({
      sessionId: 'runtime-session-x',
      storedSessionId: 'stored-session-x',
      text: 'dictated in X'
    })

    const submitFromSessionX = hook.result.current.submitDraft

    // The transcription subscription is still owned by X, but the selected
    // tab has moved to Y by the time its delayed callback fires.
    activeQueueSessionKeyRef.current = 'stored-session-y'

    act(() => submitFromSessionX())

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('dictated in X', {
        attachments: [],
        composerScope: 'stored-session-x',
        sessionId: 'runtime-session-x',
        storedSessionId: 'stored-session-x'
      })
    )
    expect(activeQueueSessionKeyRef.current).toBe('stored-session-y')
  })

  it("submits a delayed transcript from X's stashed draft after the composer loads Y", async () => {
    const attachment: ComposerAttachment = { id: 'x-file', kind: 'file', label: 'x.txt' }

    const { activeQueueSessionKeyRef, hook, onSubmit } = renderSubmitHook({
      sessionId: 'runtime-session-x',
      storedSessionId: 'stored-session-x'
    })

    stashSessionDraft('stored-session-x', 'typed in X', [attachment])
    activeQueueSessionKeyRef.current = 'stored-session-y'

    let handled = false

    act(() => {
      handled = hook.result.current.submitBackgroundDictation('dictated in X', 'stored-session-x')
    })

    expect(handled).toBe(true)
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('typed in X\ndictated in X', {
        attachments: [attachment],
        composerScope: 'stored-session-x',
        sessionId: 'runtime-session-x',
        storedSessionId: 'stored-session-x'
      })
    )
  })

  it("restores a rejected background submit only to its own session's stash", async () => {
    const { activeQueueSessionKeyRef, hook, loadIntoComposer, onSubmit, stashAt } = renderSubmitHook({
      sessionId: 'runtime-session-x',
      storedSessionId: 'stored-session-x',
      text: 'dictated in X'
    })

    const submitFromSessionX = hook.result.current.submitDraft

    onSubmit.mockResolvedValueOnce(false)
    activeQueueSessionKeyRef.current = 'stored-session-y'

    act(() => submitFromSessionX())

    await waitFor(() => expect(stashAt).toHaveBeenCalledWith('stored-session-x', 'dictated in X', []))
    expect(loadIntoComposer).not.toHaveBeenCalled()
  })
})

describe('useComposerSubmit with a clarify parked on the session', () => {
  const gatewayRequest = vi.fn(async () => ({ ok: true }))

  const parkClarify = (sessionId: string) => {
    $clarifyRequests.set({
      [sessionId]: { requestId: `req-${sessionId}`, question: 'which one?', choices: ['a', 'b'], sessionId }
    })
    $gateway.set({ request: gatewayRequest } as unknown as ReturnType<typeof $gateway.get>)
  }

  afterEach(() => {
    cleanup()
    gatewayRequest.mockClear()
    $clarifyRequests.set({})
    $gateway.set(null)
    vi.restoreAllMocks()
  })

  it('skips the question and still sends the typed message on an idle session', async () => {
    parkClarify('runtime-session')
    const { hook, onSubmit } = renderSubmitHook({ text: 'actually do this instead' })

    act(() => {
      hook.result.current.submitDraft()
    })

    await waitFor(() =>
      expect(gatewayRequest).toHaveBeenCalledWith('clarify.respond', {
        request_id: 'req-runtime-session',
        answer: ''
      })
    )
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('actually do this instead', expect.objectContaining({ attachments: [] }))
    )
    expect($clarifyRequests.get()['runtime-session']).toBeUndefined()
  })

  it('skips the question before steering a busy turn', async () => {
    parkClarify('runtime-session')
    const { hook, onSteer } = renderSubmitHook({ busy: true, text: 'change course' })

    act(() => {
      hook.result.current.submitDraft()
    })

    await waitFor(() => expect(onSteer).toHaveBeenCalledWith('change course'))
    expect(gatewayRequest).toHaveBeenCalledWith('clarify.respond', { request_id: 'req-runtime-session', answer: '' })
  })

  it('leaves the question alone for an empty Enter (Stop, not an answer)', () => {
    parkClarify('runtime-session')
    const { hook, onCancel } = renderSubmitHook({ busy: true })

    act(() => {
      hook.result.current.submitDraft()
    })

    expect(gatewayRequest).not.toHaveBeenCalled()
    expect($clarifyRequests.get()['runtime-session']).toBeDefined()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it("leaves another session's question alone", async () => {
    parkClarify('other-session')
    const { hook, onSubmit } = renderSubmitHook({ text: 'unrelated message' })

    act(() => {
      hook.result.current.submitDraft()
    })

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(gatewayRequest).not.toHaveBeenCalled()
    expect($clarifyRequests.get()['other-session']).toBeDefined()
  })
})
