import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Asset, AssetKind, ModelCoverFilter, SortKey, SortOrder } from '../types/asset'
import type { ISortStrategy } from '../types/strategies'
import { assetRepository, assetStoreLinkRepository } from '../services/repositories'
import { scanService } from '../services/scanner'
import { useSettingsStore } from './settingsStore'
import { useTagStore } from './tagStore'
import { useGroupStore } from './groupStore'
import { useThumbnailStore } from './thumbnailStore'
import { NameSortStrategy } from '../services/strategies/NameSortStrategy'
import { DateSortStrategy } from '../services/strategies/DateSortStrategy'
import { SizeSortStrategy } from '../services/strategies/SizeSortStrategy'
import { UsageSortStrategy } from '../services/strategies/UsageSortStrategy'
import { getModelCoverStatus, needsModelPreview } from '../services/modelPreviewService'
import { useUnityProjectStore } from './unityProjectStore'

const STRATEGY_MAP: Record<SortKey, ISortStrategy> = {
  name: new NameSortStrategy(),
  createdAt: new DateSortStrategy(),
  fileSize: new SizeSortStrategy(),
  lastUsedAt: new UsageSortStrategy(),
}

export const useAssetStore = defineStore('assets', () => {
  const assets = ref<Asset[]>([])
  const searchQuery = ref('')
  const isScanning = ref(false)
  const selectedIds = ref<Set<string>>(new Set())
  const showFavoritesOnly = ref(false)
  const activeAssetKind = ref<AssetKind>('package')
  const modelCoverFilter = ref<ModelCoverFilter>('all')

  const settingsStore = useSettingsStore()
  const tagStore = useTagStore()
  const groupStore = useGroupStore()
  const unityProjectStore = useUnityProjectStore()

  const kindFiltered = computed<Asset[]>(() =>
    assets.value.filter((asset) => (asset.assetKind || 'package') === activeAssetKind.value)
  )

  const coverFiltered = computed<Asset[]>(() => {
    if (activeAssetKind.value !== 'model' || modelCoverFilter.value === 'all') {
      return kindFiltered.value
    }
    return kindFiltered.value.filter((asset) =>
      getModelCoverStatus(asset) === modelCoverFilter.value
    )
  })

  const projectFiltered = computed<Asset[]>(() => {
    if (activeAssetKind.value !== 'model' || !unityProjectStore.isSynchronized || unityProjectStore.filter === 'all') {
      return coverFiltered.value
    }
    return coverFiltered.value.filter((asset) => {
      const state = unityProjectStore.getState(asset.id)
      if (unityProjectStore.filter === 'in-scene') return (state?.projectAsset?.sceneUsageCount ?? 0) > 0
      if (unityProjectStore.filter === 'duplicate') return (state?.duplicateCandidates.length ?? 0) > 1
      return (state?.status ?? 'unlinked') === unityProjectStore.filter
    })
  })

  const favoriteFiltered = computed<Asset[]>(() =>
    showFavoritesOnly.value
      ? projectFiltered.value.filter((a) => a.isFavorite)
      : projectFiltered.value
  )

  const tagFiltered = computed<Asset[]>(() =>
    tagStore.activeTagId
      ? favoriteFiltered.value.filter((a) => a.tagIds.includes(tagStore.activeTagId!))
      : favoriteFiltered.value
  )

  const groupFiltered = computed<Asset[]>(() => {
    if (!groupStore.activeGroupId) return tagFiltered.value
    const group = groupStore.groups.find((g) => g.id === groupStore.activeGroupId)
    if (!group) return tagFiltered.value
    const idSet = new Set(group.assetIds)
    return tagFiltered.value.filter((a) => idSet.has(a.id))
  })

  const searchFiltered = computed<Asset[]>(() => {
    const query = searchQuery.value.trim().toLowerCase()
    if (!query) return groupFiltered.value
    return groupFiltered.value.filter((a) => {
      if (a.name.toLowerCase().includes(query)) return true
      if (a.notes.toLowerCase().includes(query)) return true
      if (a.fileName.toLowerCase().includes(query)) return true
      for (const tagId of a.tagIds) {
        const tag = tagStore.getTagById(tagId)
        if (tag && tag.label.toLowerCase().includes(query)) return true
      }
      return false
    })
  })

  const filteredAssets = computed<Asset[]>(() => {
    const strategy = STRATEGY_MAP[settingsStore.settings.sortBy]
    const items = [...searchFiltered.value]
    const order = settingsStore.settings.sortOrder

    items.sort((a, b) => {
      const favDiff = (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0)
      if (favDiff !== 0) return favDiff
      return strategy ? strategy.compare(a, b, order) : 0
    })

    return items
  })

  const totalCount = computed(() => kindFiltered.value.length)
  const libraryTotalCount = computed(() => assets.value.length)
  const packageCount = computed(() =>
    assets.value.filter((asset) => (asset.assetKind || 'package') === 'package').length
  )
  const modelCount = computed(() =>
    assets.value.filter((asset) => asset.assetKind === 'model').length
  )
  const pendingModelCoverCount = computed(() =>
    assets.value.filter(needsModelPreview).length
  )
  const completedModelCoverCount = computed(() =>
    assets.value.filter((asset) =>
      asset.assetKind === 'model' && getModelCoverStatus(asset) === 'completed'
    ).length
  )
  const ineligibleModelCoverCount = computed(() =>
    assets.value.filter((asset) =>
      asset.assetKind === 'model' && getModelCoverStatus(asset) === 'not-needed'
    ).length
  )
  const failedModelCoverCount = computed(() =>
    assets.value.filter((asset) =>
      asset.assetKind === 'model' && getModelCoverStatus(asset) === 'failed'
    ).length
  )
  const filteredCount = computed(() => filteredAssets.value.length)
  const totalSize = computed(() =>
    kindFiltered.value.reduce((sum, a) => sum + a.fileSize, 0)
  )
  const favoriteCount = computed(() =>
    kindFiltered.value.filter((a) => a.isFavorite).length
  )
  const isMultiSelect = computed(() => selectedIds.value.size > 0)

  async function load(): Promise<void> {
    assets.value = await assetRepository.getAll()
  }

  async function scan(): Promise<void> {
    isScanning.value = true
    try {
      const classification = settingsStore.settings.classification
      await scanService.scanDirectories(
        settingsStore.settings.scanDirectories,
        classification.enabled ? classification.jsonPath : '',
      )
      await load()
      await groupStore.load()
    } finally {
      isScanning.value = false
    }
  }

  async function updateAsset(id: string, data: Partial<Asset>): Promise<void> {
    await assetRepository.update(id, { ...data, updatedAt: Date.now() })
    const index = assets.value.findIndex((a) => a.id === id)
    if (index !== -1) {
      assets.value[index] = Object.assign({}, assets.value[index], data, { updatedAt: Date.now() })
    }
  }

  async function toggleFavorite(id: string): Promise<void> {
    const asset = assets.value.find((a) => a.id === id)
    if (asset) {
      await updateAsset(id, { isFavorite: !asset.isFavorite })
    }
  }

  async function deleteAsset(id: string): Promise<void> {
    const thumbnailStore = useThumbnailStore()
    await thumbnailStore.remove(id)
    await assetStoreLinkRepository.delete(id)
    await assetRepository.delete(id)
    await groupStore.removeAssetsFromAll([id])
    assets.value = assets.value.filter((a) => a.id !== id)
    selectedIds.value.delete(id)
  }

  function setSearch(query: string): void {
    searchQuery.value = query
  }

  function setFavoritesOnly(value: boolean): void {
    showFavoritesOnly.value = value
  }

  function setActiveAssetKind(kind: AssetKind): void {
    activeAssetKind.value = kind
    tagStore.setActiveTag(null)
    groupStore.setActiveGroup(null)
    showFavoritesOnly.value = false
    modelCoverFilter.value = 'all'
    clearSelection()
  }

  function setModelCoverFilter(filter: ModelCoverFilter): void {
    modelCoverFilter.value = filter
    clearSelection()
  }

  const paintingTagId = ref<string | null>(null)

  function startTagPaint(tagId: string): void {
    paintingTagId.value = paintingTagId.value === tagId ? null : tagId
  }

  function stopTagPaint(): void {
    paintingTagId.value = null
  }

  async function paintTag(assetId: string): Promise<void> {
    if (!paintingTagId.value) return
    const asset = assets.value.find(a => a.id === assetId)
    if (!asset || asset.tagIds.includes(paintingTagId.value)) return
    await updateAsset(assetId, { tagIds: [...asset.tagIds, paintingTagId.value] })
  }

  let lastSelectedId: string | null = null

  function toggleSelection(id: string): void {
    if (selectedIds.value.has(id)) {
      selectedIds.value.delete(id)
    } else {
      selectedIds.value.add(id)
    }
    lastSelectedId = id
    selectedIds.value = new Set(selectedIds.value)
  }

  function rangeSelect(id: string): void {
    const list = filteredAssets.value
    const currentIdx = list.findIndex(a => a.id === id)
    const lastIdx = lastSelectedId ? list.findIndex(a => a.id === lastSelectedId) : -1
    if (currentIdx === -1) return
    if (lastIdx === -1) {
      toggleSelection(id)
      return
    }
    const start = Math.min(currentIdx, lastIdx)
    const end = Math.max(currentIdx, lastIdx)
    for (let i = start; i <= end; i++) {
      const asset = list[i]
      if (asset) selectedIds.value.add(asset.id)
    }
    lastSelectedId = id
    selectedIds.value = new Set(selectedIds.value)
  }

  function clearSelection(): void {
    selectedIds.value = new Set()
  }

  function selectAll(): void {
    selectedIds.value = new Set(filteredAssets.value.map((a) => a.id))
  }

  return {
    assets,
    searchQuery,
    isScanning,
    selectedIds,
    showFavoritesOnly,
    activeAssetKind,
    modelCoverFilter,
    filteredAssets,
    totalCount,
    libraryTotalCount,
    packageCount,
    modelCount,
    pendingModelCoverCount,
    completedModelCoverCount,
    ineligibleModelCoverCount,
    failedModelCoverCount,
    filteredCount,
    totalSize,
    favoriteCount,
    isMultiSelect,
    load,
    scan,
    updateAsset,
    toggleFavorite,
    deleteAsset,
    setSearch,
    setFavoritesOnly,
    setActiveAssetKind,
    setModelCoverFilter,
    paintingTagId,
    startTagPaint,
    stopTagPaint,
    paintTag,
    toggleSelection,
    rangeSelect,
    clearSelection,
    selectAll,
  }
})
