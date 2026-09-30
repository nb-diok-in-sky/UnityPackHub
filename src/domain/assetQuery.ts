import type {
  Asset,
  AssetKind,
  ModelCoverFilter,
  Tag,
  UnityAssetProjectState,
  UnityProjectFilter,
} from '../types/asset'
import type { SortKey, SortOrder } from '../types/settings'
import { modelCoverStatus } from './modelCover'

export interface AssetQuery {
  kind: AssetKind
  search: string
  favoritesOnly: boolean
  tagId: string | null
  /** Members of the selected group, or null when no group is selected. */
  groupAssetIds: ReadonlySet<string> | null
  modelCover: ModelCoverFilter
  /** Unity project filter; ignored until a project has been synchronised. */
  project: { filter: UnityProjectFilter; stateOf: (assetId: string) => UnityAssetProjectState | null } | null
  sortBy: SortKey
  sortOrder: SortOrder
}

const nameCollator = new Intl.Collator('zh-CN')

const comparators: Record<SortKey, (left: Asset, right: Asset) => number> = {
  name: (left, right) => nameCollator.compare(left.name, right.name),
  createdAt: (left, right) => left.createdAt - right.createdAt,
  fileSize: (left, right) => left.fileSize - right.fileSize,
  lastUsedAt: (left, right) => left.lastUsedAt - right.lastUsedAt,
}

/** Lower-cased text an asset is searched by: name, file name, notes and tag labels. */
export function searchText(asset: Asset, tags: ReadonlyMap<string, Tag>): string {
  return [asset.name, asset.fileName, asset.notes, ...asset.tagIds.map((id) => tags.get(id)?.label ?? '')]
    .join('\0')
    .toLocaleLowerCase('zh-CN')
}

/** Filters and sorts; favourites always come first. */
export function queryAssets(assets: readonly Asset[], query: AssetQuery, textOf: (asset: Asset) => string): Asset[] {
  const search = query.search.trim().toLocaleLowerCase('zh-CN')
  const direction = query.sortOrder === 'asc' ? 1 : -1
  const compare = comparators[query.sortBy]
  return assets
    .filter((asset) => asset.assetKind === query.kind)
    .filter(
      (asset) => query.kind !== 'model' || query.modelCover === 'all' || modelCoverStatus(asset) === query.modelCover,
    )
    .filter((asset) => matchesProject(asset, query.project))
    .filter((asset) => !query.favoritesOnly || asset.isFavorite)
    .filter((asset) => !query.tagId || asset.tagIds.includes(query.tagId))
    .filter((asset) => !query.groupAssetIds || query.groupAssetIds.has(asset.id))
    .filter((asset) => !search || textOf(asset).includes(search))
    .sort((left, right) => Number(right.isFavorite) - Number(left.isFavorite) || direction * compare(left, right))
}

function matchesProject(asset: Asset, project: AssetQuery['project']): boolean {
  if (!project || project.filter === 'all' || asset.assetKind !== 'model') return true
  const state = project.stateOf(asset.id)
  if (project.filter === 'in-scene') return (state?.projectAsset?.sceneUsageCount ?? 0) > 0
  if (project.filter === 'duplicate') return (state?.duplicateCandidates.length ?? 0) > 1
  return (state?.status ?? 'unlinked') === project.filter
}
