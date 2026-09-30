// Assets, tags and groups as records: plain persistence plus the multi-table operations.
import type { Asset, AssetGroup, Tag } from '../types/asset'
import { assetRepository, groupRepository, tagRepository } from '../data/repositories'

export const assetRecords = {
  getAll: (): Promise<Asset[]> => assetRepository.getAll(),
  update: (id: string, patch: Partial<Asset>): Promise<void> => assetRepository.update(id, patch),
  updateMany: (updates: Array<{ id: string; patch: Partial<Asset> }>): Promise<void> =>
    assetRepository.updateMany(updates),
}

export const tagRecords = {
  getAll: (): Promise<Tag[]> => tagRepository.getAll(),
  save: (tag: Tag): Promise<void> => tagRepository.put(tag),

  /** Deletes the tag and strips it from every asset; returns the ids of the assets changed. */
  async delete(tagId: string): Promise<string[]> {
    await tagRepository.delete(tagId)
    const tagged = await assetRepository.withTag(tagId)
    await assetRepository.updateMany(
      tagged.map((asset) => ({ id: asset.id, patch: { tagIds: asset.tagIds.filter((id) => id !== tagId) } })),
    )
    return tagged.map((asset) => asset.id)
  },
}

export const groupRecords = {
  getAll: (): Promise<AssetGroup[]> => groupRepository.getAll(),
  save: (group: AssetGroup): Promise<void> => groupRepository.put(group),
  delete: (id: string): Promise<void> => groupRepository.delete([id]),
}
