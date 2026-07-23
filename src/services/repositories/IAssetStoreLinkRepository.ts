import type { AssetStoreLinkRecord } from '../database'

export interface IAssetStoreLinkRepository {
  get(assetId: string): Promise<AssetStoreLinkRecord | undefined>
  save(link: AssetStoreLinkRecord): Promise<void>
  delete(assetId: string): Promise<void>
}
