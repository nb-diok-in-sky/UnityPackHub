export interface PackagePreviewRequest {
  pathname: string
  filename: string
}

export function getPackagePreviewFileName(pathname: string): string {
  let hash = 2166136261
  for (const char of pathname.replace(/\\/g, '/').toLowerCase()) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  const filename = pathname.replace(/\\/g, '/').split('/').pop() || 'prefab'
  return `${filename}--${(hash >>> 0).toString(16).padStart(8, '0')}.png`
}
