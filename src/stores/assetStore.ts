import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Asset, AssetKind, ModelCoverFilter } from '../types/asset'
import { assetRepository, assetStoreLinkRepository } from '../services/repositories'
import { scanService } from '../services/scanner'
import { useSettingsStore } from './settingsStore'
import { useTagStore } from './tagStore'
import { useGroupStore } from './groupStore'
import { useThumbnailStore } from './thumbnailStore'
import { getModelCoverStatus } from '../services/modelPreviewService'
import { useAssetFiltering } from '../composables/useAssetFiltering'

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
  const { kindAssets, filteredAssets } = useAssetFiltering(assets, {
    searchQuery,
    showFavoritesOnly,
    activeAssetKind,
    modelCoverFilter,
  })

  const totalCount = computed(() => kindAssets.value.length)
  const libraryTotalCount = computed(() => assets.value.length)
  const assetStatistics = computed(() => {
    const statistics = {
      packageCount: 0,
      modelCount: 0,
      pendingModelCoverCount: 0,
      completedModelCoverCount: 0,
      ineligibleModelCoverCount: 0,
      failedModelCoverCount: 0,
    }

    for (const asset of assets.value) {
      if ((asset.assetKind || 'package') === 'package') {
        statistics.packageCount++
        continue
      }

      statistics.modelCount++
      const status = getModelCoverStatus(asset)
      if (status === 'pending') statistics.pendingModelCoverCount++
      else if (status === 'completed') statistics.completedModelCoverCount++
      else if (status === 'not-needed') statistics.ineligibleModelCoverCount++
      else statistics.failedModelCoverCount++
    }

    return statistics
  })
  const packageCount = computed(() => assetStatistics.value.packageCount)
  const modelCount = computed(() => assetStatistics.value.modelCount)
  const pendingModelCoverCount = computed(() => assetStatistics.value.pendingModelCoverCount)
  const completedModelCoverCount = computed(() => assetStatistics.value.completedModelCoverCount)
  const ineligibleModelCoverCount = computed(() => assetStatistics.value.ineligibleModelCoverCount)
  const failedModelCoverCount = computed(() => assetStatistics.value.failedModelCoverCount)
  const filteredCount = computed(() => filteredAssets.value.length)
  const totalSize = computed(() =>
    kindAssets.value.reduce((sum, a) => sum + a.fileSize, 0)
  )
  const favoriteCount = computed(() =>
    kindAssets.value.filter((a) => a.isFavorite).length
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
