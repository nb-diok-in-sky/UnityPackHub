import type { AssetGroup } from '../../types/asset'

export interface IGroupRepository {
  getAll(): Promise<AssetGroup[]>
  getById(id: string): Promise<AssetGroup | undefined>
  create(group: AssetGroup): Promise<string>
  update(id: string, data: Partial<AssetGroup>): Promise<void>
  delete(id: string): Promise<void>
}
