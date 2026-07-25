import { computed, type Ref } from 'vue'
import type { Asset, AssetKind, ModelCoverFilter, SortKey } from '../types/asset'
import type { ISortStrategy } from '../types/strategies'
import { DateSortStrategy } from '../services/strategies/DateSortStrategy'
import { NameSortStrategy } from '../services/strategies/NameSortStrategy'
import { SizeSortStrategy } from '../services/strategies/SizeSortStrategy'
import { UsageSortStrategy } from '../services/strategies/UsageSortStrategy'
import { getModelCoverStatus } from '../services/modelPreviewService'
import { useGroupStore } from '../stores/groupStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useTagStore } from '../stores/tagStore'
import { useUnityProjectStore } from '../stores/unityProjectStore'

const SORT_STRATEGIES: Record<SortKey, ISortStrategy> = {
  name: new NameSortStrategy(),
  createdAt: new DateSortStrategy(),
  fileSize: new SizeSortStrategy(),
  lastUsedAt: new UsageSortStrategy(),
}
const nameCollator = new Intl.Collator('zh-CN')

export interface AssetFilterState {
  searchQuery: Ref<string>
  showFavoritesOnly: Ref<boolean>
  activeAssetKind: Ref<AssetKind>
  modelCoverFilter: Ref<ModelCoverFilter>
}

export function useAssetFiltering(assets: Ref<Asset[]>, state: AssetFilterState) {
  const settings = useSettingsStore()
  const tags = useTagStore()
  const groups = useGroupStore()
  const project = useUnityProjectStore()

  const kindAssets = computed(() => assets.value.filter(asset => assetKind(asset) === state.activeAssetKind.value))
  const searchIndex = computed(() => {
    const tagLabels = tags.tagMap
    return new Map(assets.value.map((asset): [string, string] => [asset.id,
      [
        asset.name,
        asset.notes,
        asset.fileName,
        ...asset.tagIds.map((tagId) => tagLabels.get(tagId)?.label ?? ''),
      ].join('\0').toLocaleLowerCase('zh-CN'),
    ]))
  })

  const filteredAssets = computed(() => {
    const query = state.searchQuery.value.trim().toLowerCase()
    const activeGroup = groups.groups.find(group => group.id === groups.activeGroupId)
    const groupIds = activeGroup ? new Set(activeGroup.assetIds) : null
    const sortKey = settings.settings.sortBy
    const sortOrder = settings.settings.sortOrder
    const strategy = SORT_STRATEGIES[sortKey]

    return kindAssets.value.filter(asset => {
      if (state.activeAssetKind.value === 'model' && state.modelCoverFilter.value !== 'all' && getModelCoverStatus(asset) !== state.modelCoverFilter.value) return false
      if (!matchesProjectFilter(asset, project)) return false
      if (state.showFavoritesOnly.value && !asset.isFavorite) return false
      if (tags.activeTagId && !asset.tagIds.includes(tags.activeTagId)) return false
      if (groupIds && !groupIds.has(asset.id)) return false
      return !query || searchIndex.value.get(asset.id)?.includes(query)
    }).sort((left, right) => {
      const favoriteDifference = Number(right.isFavorite) - Number(left.isFavorite)
      if (favoriteDifference) return favoriteDifference
      if (sortKey === 'name') {
        const difference = nameCollator.compare(left.name, right.name)
        return sortOrder === 'asc' ? difference : -difference
      }
      return strategy.compare(left, right, sortOrder)
    })
  })

  return { kindAssets, filteredAssets }
}

function assetKind(asset: Asset): AssetKind {
  return asset.assetKind || 'package'
}

function matchesProjectFilter(asset: Asset, project: ReturnType<typeof useUnityProjectStore>): boolean {
  if (assetKind(asset) !== 'model' || !project.isSynchronized || project.filter === 'all') return true
  const state = project.getState(asset.id)
  if (project.filter === 'in-scene') return (state?.projectAsset?.sceneUsageCount ?? 0) > 0
  if (project.filter === 'duplicate') return (state?.duplicateCandidates.length ?? 0) > 1
  return (state?.status ?? 'unlinked') === project.filter
}
