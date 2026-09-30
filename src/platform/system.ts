// Tauri plugins (dialogs, files, shell, http, drag & drop). Only the platform layer may import them.
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import {
  BaseDirectory,
  exists,
  mkdir,
  readFile,
  readTextFile,
  stat,
  writeFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import { open as openInShell } from '@tauri-apps/plugin-shell'
import { fetch as httpFetch } from '@tauri-apps/plugin-http'

export interface FileFilter {
  name: string
  extensions: string[]
}

export async function pickDirectory(): Promise<string | null> {
  const selected = await openDialog({ directory: true, multiple: false })
  return typeof selected === 'string' ? selected : null
}

export async function pickFile(filters: FileFilter[]): Promise<string | null> {
  const selected = await openDialog({ directory: false, multiple: false, filters })
  return typeof selected === 'string' ? selected : null
}

export async function pickSavePath(defaultPath: string, filters: FileFilter[]): Promise<string | null> {
  return (await saveDialog({ defaultPath, filters })) ?? null
}

export function readBinaryFile(path: string): Promise<Uint8Array> {
  return readFile(path)
}

export function writeTextFileAt(path: string, content: string): Promise<void> {
  return writeTextFile(path, content)
}

export function readTextFileAt(path: string): Promise<string> {
  return readTextFile(path)
}

export function writeBinaryFileAt(path: string, content: Uint8Array): Promise<void> {
  return writeFile(path, content)
}

export function createDirectory(path: string): Promise<void> {
  return mkdir(path, { recursive: true })
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    return await exists(path)
  } catch {
    return false
  }
}

export async function fileSize(path: string): Promise<number | null> {
  try {
    return (await stat(path)).size
  } catch {
    return null
  }
}

/** Text files in the app's own data folder (%APPDATA%/com.unitypackhub.app). */
export const appData = {
  async read(name: string): Promise<string | null> {
    if (!(await exists(name, { baseDir: BaseDirectory.AppData }))) return null
    return readTextFile(name, { baseDir: BaseDirectory.AppData })
  },
  async write(name: string, content: string): Promise<void> {
    if (!(await exists('', { baseDir: BaseDirectory.AppData })))
      await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true })
    await writeTextFile(name, content, { baseDir: BaseDirectory.AppData })
  },
}

export async function openExternal(url: string): Promise<void> {
  await openInShell(url)
}

export interface HttpResponse {
  ok: boolean
  status: number
  url: string
  text(): Promise<string>
  blob(): Promise<Blob>
}

/** Image as a blob, from any URL the WebView itself can load (app files, data URLs). */
export async function fetchImage(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.blob()
}

/** HTTP through the Rust side, so requests are not bound by the WebView's CORS rules. */
export function httpGet(url: string, headers: Record<string, string> = {}): Promise<HttpResponse> {
  return httpFetch(url, { headers, redirect: 'follow' })
}

/** Calls `handler` with the paths of files dropped anywhere on the window. */
export async function onFileDrop(
  handler: (event: { type: 'enter' | 'over' | 'leave' | 'drop'; paths: string[] }) => void,
): Promise<() => void> {
  const { getCurrentWebview } = await import('@tauri-apps/api/webview')
  return getCurrentWebview().onDragDropEvent(({ payload }) => {
    handler({ type: payload.type, paths: 'paths' in payload ? payload.paths : [] })
  })
}
