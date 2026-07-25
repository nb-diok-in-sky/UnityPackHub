import type { Asset } from '../../types/asset'
import { assetRepository } from '../repositories'

export async function loadAssets(ids: string[]): Promise<Asset[]> {
  const assets = await Promise.all(ids.map(id => assetRepository.getById(id)))
  return assets.filter((asset): asset is Asset => asset !== undefined)
}

export async function updateAssets(updates: Array<{ id: string; data: Partial<Asset> }>): Promise<void> {
  if (updates.length > 0) await assetRepository.bulkUpdate(updates)
}
