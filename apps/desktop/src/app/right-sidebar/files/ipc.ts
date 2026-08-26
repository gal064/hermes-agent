import type { HermesReadDirEntry, HermesReadDirResult } from '@/global'
import { readDesktopDir } from '@/lib/desktop-fs'
import { ALWAYS_EXCLUDED } from '@/lib/excluded-paths'

export type ProjectTreeEntry = HermesReadDirEntry

/**
 * Project-explorer directory read. Unlike upstream, `.gitignore` never hides an
 * entry here — ignore rules describe version-control intent, not whether a file
 * is worth inspecting. Only the fixed VCS/dependency/build/OS noise set is
 * excluded. `rootPath` is accepted so upstream call sites compile unchanged.
 */
export async function readProjectDir(dirPath: string, _rootPath = dirPath): Promise<HermesReadDirResult> {
  if (!window.hermesDesktop) {
    return { entries: [], error: 'no-bridge' }
  }

  const result = await readDesktopDir(dirPath)
  const entries = (result?.entries ?? []).filter(entry => !ALWAYS_EXCLUDED.has(entry.name))

  return { ...result, entries }
}

/** No gitignore rules are cached, so there is nothing to invalidate. Kept as a
 *  no-op so upstream's connection-change call site stays untouched. */
export function clearProjectDirCache(_rootPath?: string) {}
