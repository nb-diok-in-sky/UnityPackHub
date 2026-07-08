import type { Asset } from '../../types/asset'
import type { IAssetRepository } from './IAssetRepository'
import { db } from '../database'

export class DexieAssetRepository implements IAssetRepository {
  async getAll(): Promise<Asset[]> {
    return db.assets.toArray()
  }

  async getById(id: string): Promise<Asset | undefined> {
    return db.assets.get(id)
  }

  async create(asset: Asset): Promise<string> {
    await db.assets.add(asset)
    return asset.id
  }

  async update(id: string, data: Partial<Asset>): Promise<void> {
    await db.assets.update(id, data)
  }

  async delete(id: string): Promise<void> {
    await db.assets.delete(id)
  }

  async bulkCreate(assets: Asset[]): Promise<void> {
    await db.assets.bulkPut(assets)
  }

  async bulkDelete(ids: string[]): Promise<void> {
    await db.assets.bulkDelete(ids)
  }

  async findByTags(tagIds: string[]): Promise<Asset[]> {
    return db.assets
      .where('tagIds')
      .anyOf(tagIds)
      .toArray()
  }

  async search(keyword: string): Promise<Asset[]> {
    const lower = keyword.toLowerCase()
    return db.assets
      .filter((asset) =>
        asset.name.toLowerCase().includes(lower) ||
        asset.notes.toLowerCase().includes(lower) ||
        asset.fileName.toLowerCase().includes(lower)
      )
      .toArray()
  }

  async getByFilePath(filePath: string): Promise<Asset | undefined> {
    return db.assets.where('filePath').equals(filePath).first()
  }
}

export const assetRepository = new DexieAssetRepository()
