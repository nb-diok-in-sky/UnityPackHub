export interface PackagePreviewRequest {
  pathname: string
  filename: string
}

export function getPackagePreviewFileName(pathname: string): string {
  return `${fileName(pathname, 'prefab')}--${fnv1a32(pathname)}.png`
}
import { fileName, fnv1a32 } from '../utils/pathIdentity'
