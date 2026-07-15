import type { Asset, AssetGroup } from '../types/asset'
import { groupRepository } from './repositories'
import { commands, type AssetMetadata } from './tauriCommands'
import { v4 as uuidv4 } from 'uuid'

const CLASSIFICATION_SOURCE = 'classification' as const
const DEFAULT_GROUP_ICON = 'category'

export interface ClassificationSyncResult {
  matchedAssetCount: number
  categoryCount: number
  unmatchedAssetCount: number
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLocaleLowerCase()
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

function categoryOf(entry: AssetMetadata): string | null {
  const category = entry.inferredObject?.trim()
  return category ? category : null
}

function buildNameIndex(entries: AssetMetadata[]): Map<string, AssetMetadata | null> {
  const index = new Map<string, AssetMetadata | null>()
  for (const entry of entries) {
    const key = normalizeName(entry.originalName)
    if (!key) continue
    if (index.has(key)) {
      index.set(key, null)
    } else {
      index.set(key, entry)
    }
  }
  return index
}

export class ClassificationService {
  async sync(jsonPath: string, assets: Asset[]): Promise<ClassificationSyncResult> {
    const entries = await commands.readAssetMetadataTable(jsonPath)
    if (entries.length === 0) {
      throw new Error('The classification table contains no assets')
    }
    const categorizedEntries = entries.filter((entry) => categoryOf(entry) !== null)
    if (categorizedEntries.length === 0) {
      throw new Error('The classification table contains no inferredObject categories')
    }
    const pathIndex = new Map(
      categorizedEntries
        .filter((entry) => entry.path.trim().length > 0)
        .map((entry) => [normalizePath(entry.path), entry]),
    )
    const nameIndex = buildNameIndex(categorizedEntries)
    const assetIdsByCategory = new Map<string, string[]>()
    let matchedAssetCount = 0
    let modelAssetCount = 0

    for (const asset of assets) {
      if (asset.assetKind !== 'model') continue
      modelAssetCount += 1
      const entry = pathIndex.get(normalizePath(asset.filePath))
        ?? nameIndex.get(normalizeName(asset.fileName))
      if (!entry) continue
      const category = categoryOf(entry)
      if (!category) continue
      const assetIds = assetIdsByCategory.get(category) ?? []
      assetIds.push(asset.id)
      assetIdsByCategory.set(category, assetIds)
      matchedAssetCount += 1
    }

    await this.replaceGeneratedGroups(assetIdsByCategory)
    return {
      matchedAssetCount,
      categoryCount: assetIdsByCategory.size,
      unmatchedAssetCount: modelAssetCount - matchedAssetCount,
    }
  }

  async clear(): Promise<void> {
    const groups = await groupRepository.getAll()
    await Promise.all(
      groups
        .filter((group) => group.source === CLASSIFICATION_SOURCE)
        .map((group) => groupRepository.delete(group.id)),
    )
  }

  private async replaceGeneratedGroups(assetIdsByCategory: Map<string, string[]>): Promise<void> {
    const existingGroups = await groupRepository.getAll()
    const generatedByKey = new Map(
      existingGroups
        .filter((group) => group.source === CLASSIFICATION_SOURCE && group.sourceKey)
        .map((group) => [group.sourceKey as string, group]),
    )
    const maxManualOrder = existingGroups
      .filter((group) => group.source !== CLASSIFICATION_SOURCE)
      .reduce((max, group) => Math.max(max, group.order), 0)
    const categories = [...assetIdsByCategory.keys()].sort((a, b) => a.localeCompare(b))

    for (let index = 0; index < categories.length; index += 1) {
      const category = categories[index]
      if (!category) continue
      const assetIds = assetIdsByCategory.get(category) ?? []
      const existing = generatedByKey.get(category)
      if (existing) {
        await groupRepository.update(existing.id, {
          name: category,
          assetIds,
          order: maxManualOrder + index + 1,
        })
        generatedByKey.delete(category)
      } else {
        const group: AssetGroup = {
          id: uuidv4(),
          name: category,
          icon: DEFAULT_GROUP_ICON,
          assetIds,
          order: maxManualOrder + index + 1,
          createdAt: Date.now(),
          source: CLASSIFICATION_SOURCE,
          sourceKey: category,
          assetKind: 'model',
        }
        await groupRepository.create(group)
      }
    }

    await Promise.all([...generatedByKey.values()].map((group) => groupRepository.delete(group.id)))
  }
}

export const classificationService = new ClassificationService()
