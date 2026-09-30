export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

/** Joins with the separator the base path already uses (backslash for Windows paths). */
export function joinPath(base: string, ...parts: string[]): string {
  const separator = base.includes('\\') || !base.includes('/') ? '\\' : '/'
  return [base.replace(/[\\/]+$/, ''), ...parts].join(separator)
}

/** Folder containing a file, or '' for a bare file name. */
export function parentDirectory(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return index > 0 ? path.slice(0, index) : ''
}

export function fileName(path: string, fallback = ''): string {
  return normalizePath(path).split('/').pop() || fallback
}

/** Separator-aware, case-insensitive: "D:\Assets" contains "D:\Assets\a" but not "D:\Assets2\a". */
export function isInsideDirectory(filePath: string, directory: string): boolean {
  const normalize = (value: string) => normalizePath(value).replace(/\/+$/, '').toLowerCase()
  const file = normalize(filePath)
  const dir = normalize(directory)
  return file === dir || file.startsWith(`${dir}/`)
}

/**
 * Whether an asset belongs in the library view: its scan folder is enabled and was readable
 * in the last scan. Other assets are hidden, not deleted, so their data survives.
 */
export function isAssetAvailable(asset: { filePath: string; offline?: boolean }, enabledDirectories: readonly string[]): boolean {
  return !asset.offline && enabledDirectories.some((directory) => isInsideDirectory(asset.filePath, directory))
}

/**
 * Name of the folder that holds a package's Unity-rendered previews. Keyed by the full path so
 * two packages with the same file name do not share previews. The hash runs over UTF-16 code
 * units; it only has to be stable, and changing it would orphan existing preview folders.
 */
export function packagePreviewKey(packagePath: string): string {
  const normalized = normalizePath(packagePath)
  const base = fileName(normalized, 'unknown').replace(/\.unitypackage$/i, '')
  let hash = 2166136261
  for (const character of normalized.toLowerCase()) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `${base}--${(hash >>> 0).toString(16).padStart(8, '0')}`
}
