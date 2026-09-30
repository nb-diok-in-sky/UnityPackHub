import Dexie, { type Table } from 'dexie'
import type { Asset, AssetGroup, Tag, UnityAssetLink } from '../types/asset'
import { dataUrlToBlob, migrateAssetRecord, type LegacyAssetRecord } from '../domain/legacyRecords'

export interface ShowcaseCacheRecord {
  filePath: string
  fileSize: number
  parsedAt: number
  data: string
}

export interface CoverRecord {
  id: string
  blob: Blob
}

export interface AssetStoreLinkRecord {
  assetId: string
  packageId: string
  productName: string
  productUrl: string
  imageUrl: string
  linkedAt: number
}

const ASSET_INDEXES =
  'id, name, fileName, filePath, fileSize, isFavorite, assetKind, createdAt, updatedAt, lastUsedAt, *tagIds'

class AppDatabase extends Dexie {
  assets!: Table<Asset, string>
  tags!: Table<Tag, string>
  groups!: Table<AssetGroup, string>
  showcaseCache!: Table<ShowcaseCacheRecord, string>
  /** Cover images; the physical table keeps its historical name. */
  thumbnails!: Table<CoverRecord, string>
  unityAssetLinks!: Table<UnityAssetLink, string>
  assetStoreLinks!: Table<AssetStoreLinkRecord, string>

  constructor() {
    super('UnityPackHub')

    // Versions 1-7 are kept verbatim so existing databases can still be upgraded.
    this.version(1).stores({
      assets: 'id, name, fileName, filePath, fileSize, isFavorite, createdAt, updatedAt, lastUsedAt, *tagIds',
      tags: 'id, label',
      settings: 'id',
    })
    this.version(2).stores({ groups: 'id, name, order' })
    this.version(3).stores({ showcaseCache: 'filePath' })
    this.version(4).stores({ thumbnails: 'id' })
    this.version(5)
      .stores({ assets: ASSET_INDEXES })
      .upgrade((tx) =>
        tx
          .table('assets')
          .toCollection()
          .modify((asset: { assetKind?: string }) => {
            asset.assetKind ||= 'package'
          }),
      )
    this.version(6).stores({ unityAssetLinks: 'id, assetId, projectPath, unityGuid, unityPath, status' })
    this.version(7).stores({ assetStoreLinks: 'assetId, packageId, productName' })

    // Version 8: `thumbnailPath` becomes `cover`, model fields move into `modelPreview`, inline
    // data-URL covers move into the cover table, and the unused settings table is dropped.
    this.version(8)
      .stores({ settings: null })
      .upgrade(async (tx) => {
        const records = await tx.table<LegacyAssetRecord>('assets').toArray()
        const inlineCovers = records
          .filter((record) => record.thumbnailPath?.startsWith('data:'))
          .map((record) => ({ id: record.id, blob: dataUrlToBlob(record.thumbnailPath ?? '') }))
        if (inlineCovers.length > 0) await tx.table('thumbnails').bulkPut(inlineCovers)
        await tx.table('assets').bulkPut(records.map(migrateAssetRecord))
      })
  }
}

export const db = new AppDatabase()
