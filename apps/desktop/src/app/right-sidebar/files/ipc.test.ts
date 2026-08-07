import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { HermesReadDirEntry, HermesReadDirResult } from '@/global'
import { $connection } from '@/store/session'

import { readProjectDir } from './ipc'

const readDir = vi.fn<(path: string) => Promise<HermesReadDirResult>>()
const api = vi.fn()
const gitRoot = vi.fn(async () => '/repo')
const readFileDataUrl = vi.fn(async () => 'data:text/plain,.env%0Adebug.log%0A')

function ok(entries: HermesReadDirEntry[]): HermesReadDirResult {
  return { entries }
}

function installBridge() {
  ;(
    window as unknown as {
      hermesDesktop: {
        api: typeof api
        gitRoot: typeof gitRoot
        readDir: typeof readDir
        readFileDataUrl: typeof readFileDataUrl
      }
    }
  ).hermesDesktop = {
    api,
    gitRoot,
    readDir,
    readFileDataUrl
  }
}

describe('readProjectDir', () => {
  beforeEach(() => {
    $connection.set(null)
    api.mockReset()
    gitRoot.mockClear()
    readDir.mockReset()
    readFileDataUrl.mockClear()
    installBridge()
  })

  afterEach(() => {
    $connection.set(null)
    delete (window as unknown as { hermesDesktop?: unknown }).hermesDesktop
  })

  it('returns no-bridge when the desktop bridge is unavailable', async () => {
    delete (window as unknown as { hermesDesktop?: unknown }).hermesDesktop

    await expect(readProjectDir('/repo')).resolves.toEqual({ entries: [], error: 'no-bridge' })
  })

  it('shows ordinary entries without consulting gitignore metadata', async () => {
    readDir.mockResolvedValue(
      ok([
        { name: '.gitignore', path: '/repo/.gitignore', isDirectory: false },
        { name: '.env', path: '/repo/.env', isDirectory: false },
        { name: 'debug.log', path: '/repo/debug.log', isDirectory: false },
        { name: 'src', path: '/repo/src', isDirectory: true }
      ])
    )

    const result = await readProjectDir('/repo')

    expect(result.entries.map(entry => entry.name)).toEqual(['.gitignore', '.env', 'debug.log', 'src'])
    expect(readDir).toHaveBeenCalledOnce()
    expect(readDir).toHaveBeenCalledWith('/repo')
    expect(gitRoot).not.toHaveBeenCalled()
    expect(readFileDataUrl).not.toHaveBeenCalled()
  })

  it('keeps fixed noise entries hidden regardless of gitignore', async () => {
    readDir.mockResolvedValue(
      ok([
        { name: '.git', path: '/repo/.git', isDirectory: true },
        { name: 'node_modules', path: '/repo/node_modules', isDirectory: true },
        { name: '.venv', path: '/repo/.venv', isDirectory: true },
        { name: 'venv', path: '/repo/venv', isDirectory: true },
        { name: 'dist', path: '/repo/dist', isDirectory: true },
        { name: 'build', path: '/repo/build', isDirectory: true },
        { name: 'generated.txt', path: '/repo/generated.txt', isDirectory: false }
      ])
    )

    const result = await readProjectDir('/repo')

    expect(result.entries.map(entry => entry.name)).toEqual(['generated.txt'])
  })

  it('shows gitignored entries from a remote Desktop connection', async () => {
    $connection.set({ mode: 'remote', profile: 'remote-dev' } as never)
    api.mockResolvedValue(
      ok([
        { name: '.env', path: '/srv/repo/.env', isDirectory: false },
        { name: 'generated.log', path: '/srv/repo/generated.log', isDirectory: false }
      ])
    )

    const result = await readProjectDir('/srv/repo')

    expect(result.entries.map(entry => entry.name)).toEqual(['.env', 'generated.log'])
    expect(readDir).not.toHaveBeenCalled()
    expect(api).toHaveBeenCalledWith({
      path: '/api/fs/list?path=%2Fsrv%2Frepo',
      profile: 'remote-dev'
    })
  })

  it('preserves directory read errors', async () => {
    readDir.mockResolvedValue({ entries: [], error: 'EACCES' })

    await expect(readProjectDir('/repo')).resolves.toEqual({ entries: [], error: 'EACCES' })
  })
})
