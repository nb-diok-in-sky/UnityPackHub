export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

export function fileName(path: string, fallback = ''): string {
  return normalizePath(path).split('/').pop() || fallback
}

export function fnv1a32(value: string): string {
  let hash = 2166136261
  for (const character of normalizePath(value).toLowerCase()) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
