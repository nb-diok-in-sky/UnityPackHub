import { fileName, fnv1a32, normalizePath } from '../utils/pathIdentity'

export function getPackagePreviewKey(filePath: string): string {
  const normalized = normalizePath(filePath)
  const name = fileName(normalized, 'unknown')
  const base = name.replace(/\.unitypackage$/i, '')
  return `${base}--${fnv1a32(normalized)}`
}
