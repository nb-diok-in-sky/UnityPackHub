import type { Asset } from '../types/asset'
import type { AssetMetadata } from '../platform/backend'
import { normalizePath } from './paths'

export interface Classification {
  /** Category name -> ids of the model assets in it. */
  assetIdsByCategory: Map<string, string[]>
  matchedAssetCount: number
  unmatchedAssetCount: number
}

const normalizeName = (name: string) => name.trim().toLocaleLowerCase()
const categoryOf = (entry: AssetMetadata) => entry.inferredObject?.trim() || null

/**
 * Groups model assets by the `inferredObject` of a metadata table. Rows match by full path
 * first, then by file name when that name is unique in the table.
 */
export function classifyModels(entries: readonly AssetMetadata[], assets: readonly Asset[]): Classification {
  if (entries.length === 0) throw new Error('The classification table contains no assets')
  const categorized = entries.filter((entry) => categoryOf(entry) !== null)
  if (categorized.length === 0) throw new Error('The classification table contains no inferredObject categories')

  const byPath = new Map(
    categorized
      .filter((entry) => entry.path.trim().length > 0)
      .map((entry) => [normalizePath(entry.path).toLocaleLowerCase(), entry]),
  )
  const byName = new Map<string, AssetMetadata | null>()
  for (const entry of categorized) {
    const key = normalizeName(entry.originalName)
    if (key) byName.set(key, byName.has(key) ? null : entry)
  }

  const assetIdsByCategory = new Map<string, string[]>()
  const models = assets.filter((asset) => asset.assetKind === 'model')
  let matchedAssetCount = 0
  for (const asset of models) {
    const entry =
      byPath.get(normalizePath(asset.filePath).toLocaleLowerCase()) ?? byName.get(normalizeName(asset.fileName))
    const category = entry ? categoryOf(entry) : null
    if (!category) continue
    assetIdsByCategory.set(category, [...(assetIdsByCategory.get(category) ?? []), asset.id])
    matchedAssetCount++
  }
  return { assetIdsByCategory, matchedAssetCount, unmatchedAssetCount: models.length - matchedAssetCount }
}
