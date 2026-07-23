export function getPackagePreviewKey(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const name = normalized.split('/').pop() || 'unknown'
  const base = name.replace(/\.unitypackage$/i, '')
  let hash = 2166136261
  for (const char of normalized.toLowerCase()) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `${base}--${(hash >>> 0).toString(16).padStart(8, '0')}`
}
