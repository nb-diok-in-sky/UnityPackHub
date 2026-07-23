import type { AssetStoreLinkRecord } from '../database'
import { db } from '../database'
import type { IAssetStoreLinkRepository } from './IAssetStoreLinkRepository'

export class DexieAssetStoreLinkRepository implements IAssetStoreLinkRepository {
  get(assetId: string): Promise<AssetStoreLinkRecord | undefined> {
    return db.assetStoreLinks.get(assetId)
  }

  async save(link: AssetStoreLinkRecord): Promise<void> {
    await db.assetStoreLinks.put(link)
  }

  async delete(assetId: string): Promise<void> {
    await db.assetStoreLinks.delete(assetId)
  }
}

export const assetStoreLinkRepository = new DexieAssetStoreLinkRepository()
