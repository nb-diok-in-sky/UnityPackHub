// Backup folder format: <folder>/data.json plus one image file per cover in <folder>/covers/.
import type { Asset, AssetGroup, Tag, UnityAssetLink } from '../types/asset'
import type { UserSettings } from '../types/settings'

export const BACKUP_FORMAT = 'unitypackhub-backup'
export const BACKUP_VERSION = 1
export const BACKUP_DATA_FILE = 'data.json'
export const BACKUP_COVERS_DIR = 'covers'

export interface BackupCover {
  id: string
  file: string
  type: string
}

export interface BackupData {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: number
  settings: UserSettings
  assets: Asset[]
  tags: Tag[]
  groups: AssetGroup[]
  unityAssetLinks: UnityAssetLink[]
  assetStoreLinks: Array<{
    assetId: string
    packageId: string
    productName: string
    productUrl: string
    imageUrl: string
    linkedAt: number
  }>
  covers: BackupCover[]
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/tiff': 'tiff',
}

/** Cover file name inside the backup; ids are UUIDs, so they are safe file names. */
export function coverFileName(id: string, type: string): string {
  return `${id}.${EXTENSIONS[type] ?? 'bin'}`
}

/** e.g. "UnityPackHub-backup-20260930-1405". */
export function backupFolderName(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `UnityPackHub-backup-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

export class InvalidBackupError extends Error {}

/** Checks a parsed data.json before anything in the library is replaced. */
export function parseBackup(raw: unknown): BackupData {
  if (!raw || typeof raw !== 'object') throw new InvalidBackupError('not an object')
  const data = raw as Partial<BackupData>
  if (data.format !== BACKUP_FORMAT) throw new InvalidBackupError('not a UnityPackHub backup')
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION)
    throw new InvalidBackupError(`unsupported backup version ${String(data.version)}`)
  for (const key of ['assets', 'tags', 'groups', 'unityAssetLinks', 'assetStoreLinks', 'covers'] as const) {
    if (!Array.isArray(data[key])) throw new InvalidBackupError(`missing ${key}`)
  }
  if (!data.assets?.every((asset) => typeof asset?.id === 'string' && typeof asset.filePath === 'string')) {
    throw new InvalidBackupError('malformed assets')
  }
  return data as BackupData
}
