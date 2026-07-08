import type { Asset } from '../../types/asset'

export interface IAssetRepository {
  getAll(): Promise<Asset[]>
  getById(id: string): Promise<Asset | undefined>
  create(asset: Asset): Promise<string>
  update(id: string, data: Partial<Asset>): Promise<void>
  delete(id: string): Promise<void>
  bulkCreate(assets: Asset[]): Promise<void>
  bulkDelete(ids: string[]): Promise<void>
  findByTags(tagIds: string[]): Promise<Asset[]>
  search(keyword: string): Promise<Asset[]>
  getByFilePath(filePath: string): Promise<Asset | undefined>
}
