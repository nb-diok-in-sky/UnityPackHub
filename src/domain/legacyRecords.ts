// Conversion of asset records written by UnityPackHub <= 0.4 (database version 7).
import type { Asset } from '../types/asset'

/** Shape of an asset record before database version 8. */
export interface LegacyAssetRecord extends Omit<Asset, 'cover' | 'modelPreview'> {
  /** '' = no cover, 'db' = blob in the thumbnails table, 'data:...' = inline image. */
  thumbnailPath?: string
  modelPreviewVersion?: number
  modelPreviewError?: string
  modelPreviewEligible?: boolean
}

export function migrateAssetRecord(record: LegacyAssetRecord): Asset {
  const { thumbnailPath = '', modelPreviewVersion, modelPreviewError, modelPreviewEligible, ...rest } = record
  const assetKind = rest.assetKind || 'package'
  return {
    ...rest,
    assetKind,
    cover: thumbnailPath === 'db' || thumbnailPath.startsWith('data:') ? 'stored' : 'none',
    ...(assetKind === 'model'
      ? { modelPreview: { version: modelPreviewVersion ?? 0, error: modelPreviewError ?? '', eligible: modelPreviewEligible !== false } }
      : {}),
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header = '', payload = ''] = dataUrl.split(',', 2)
  const type = header.match(/^data:([^;,]+)/)?.[1] ?? 'application/octet-stream'
  if (!header.includes(';base64')) return new Blob([decodeURIComponent(payload)], { type })
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type })
}
