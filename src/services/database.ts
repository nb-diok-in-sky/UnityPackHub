import Dexie, { type Table } from 'dexie'
import type { Asset, Tag, UserSettings, AssetGroup } from '../types/asset'

export interface ShowcaseCache {
  filePath: string
  fileSize: number
  parsedAt: number
  data: string
}

export interface ThumbnailRecord {
  id: string
  blob: Blob
}

class AppDatabase extends Dexie {
  assets!: Table<Asset, string>
  tags!: Table<Tag, string>
  settings!: Table<UserSettings, string>
  groups!: Table<AssetGroup, string>
  showcaseCache!: Table<ShowcaseCache, string>
  thumbnails!: Table<ThumbnailRecord, string>

  constructor() {
    super('UnityPackHub')

    this.version(1).stores({
      assets: 'id, name, fileName, filePath, fileSize, isFavorite, createdAt, updatedAt, lastUsedAt, *tagIds',
      tags: 'id, label',
      settings: 'id',
    })

    this.version(2).stores({
      assets: 'id, name, fileName, filePath, fileSize, isFavorite, createdAt, updatedAt, lastUsedAt, *tagIds',
      tags: 'id, label',
      settings: 'id',
      groups: 'id, name, order',
    })

    this.version(3).stores({
      assets: 'id, name, fileName, filePath, fileSize, isFavorite, createdAt, updatedAt, lastUsedAt, *tagIds',
      tags: 'id, label',
      settings: 'id',
      groups: 'id, name, order',
      showcaseCache: 'filePath',
    })

    this.version(4).stores({
      assets: 'id, name, fileName, filePath, fileSize, isFavorite, createdAt, updatedAt, lastUsedAt, *tagIds',
      tags: 'id, label',
      settings: 'id',
      groups: 'id, name, order',
      showcaseCache: 'filePath',
      thumbnails: 'id',
    })

    this.version(5).stores({
      assets: 'id, name, fileName, filePath, fileSize, isFavorite, assetKind, createdAt, updatedAt, lastUsedAt, *tagIds',
      tags: 'id, label',
      settings: 'id',
      groups: 'id, name, order',
      showcaseCache: 'filePath',
      thumbnails: 'id',
    }).upgrade(tx => {
      return tx.table('assets').toCollection().modify(asset => {
        if (!asset.assetKind) {
          asset.assetKind = 'package'
        }
      })
    })
  }
}

export const db = new AppDatabase()
