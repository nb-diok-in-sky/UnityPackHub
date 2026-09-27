// Model categories generated from an external metadata table (see Settings > Classification).
import { v4 as uuid } from 'uuid'
import type { Asset, AssetGroup } from '../types/asset'
import { classifyModels, type Classification } from '../domain/classification'
import { backend } from '../platform/backend'
import { groupRepository } from '../data/repositories'

const SOURCE = 'classification' as const
const ICON = 'category'

export const classificationService = {
  /** Rebuilds the generated category groups; manual groups are never touched. */
  async sync(jsonPath: string, assets: Asset[]): Promise<Classification> {
    const classification = classifyModels(await backend.readAssetMetadataTable(jsonPath), assets)
    const existing = await groupRepository.getAll()
    const generated = new Map(existing
      .filter((group) => group.source === SOURCE && group.sourceKey)
      .map((group) => [group.sourceKey as string, group]))
    const firstOrder = existing.filter((group) => group.source !== SOURCE).reduce((max, group) => Math.max(max, group.order), 0) + 1

    const categories = [...classification.assetIdsByCategory.keys()].sort((left, right) => left.localeCompare(right))
    for (const [index, category] of categories.entries()) {
      const assetIds = classification.assetIdsByCategory.get(category) ?? []
      const current = generated.get(category)
      generated.delete(category)
      const group: AssetGroup = current
        ? { ...current, name: category, assetIds, order: firstOrder + index }
        : { id: uuid(), name: category, icon: ICON, assetIds, order: firstOrder + index, createdAt: Date.now(), source: SOURCE, sourceKey: category, assetKind: 'model' }
      await groupRepository.put(group)
    }
    await groupRepository.delete([...generated.values()].map((group) => group.id))
    return classification
  },

  async clear(): Promise<void> {
    const groups = await groupRepository.getAll()
    await groupRepository.delete(groups.filter((group) => group.source === SOURCE).map((group) => group.id))
  },
}
