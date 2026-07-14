import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Asset, AssetKind, SortKey, SortOrder } from '../types/asset'
import type { ISortStrategy } from '../types/strategies'
import { assetRepository } from '../services/repositories'
import { scanService } from '../services/scanner'
import { useSettingsStore } from './settingsStore'
import { useTagStore } from './tagStore'
import { useGroupStore } from './groupStore'
import { useThumbnailStore } from './thumbnailStore'
import { NameSortStrategy } from '../services/strategies/NameSortStrategy'
import { DateSortStrategy } from '../services/strategies/DateSortStrategy'
import { SizeSortStrategy } from '../services/strategies/SizeSortStrategy'
import { UsageSortStrategy } from '../services/strategies/UsageSortStrategy'

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

  const settingsStore = useSettingsStore()
  const tagStore = useTagStore()
  const groupStore = useGroupStore()

  const kindFiltered = computed<Asset[]>(() =>
    assets.value.filter((asset) => (asset.assetKind || 'package') === activeAssetKind.value)
  )

  const favoriteFiltered = computed<Asset[]>(() =>
    showFavoritesOnly.value
      ? kindFiltered.value.filter((a) => a.isFavorite)
      : kindFiltered.value
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

  const totalCount = computed(() => assets.value.length)
  const packageCount = computed(() =>
    assets.value.filter((asset) => (asset.assetKind || 'package') === 'package').length
  )
  const modelCount = computed(() =>
    assets.value.filter((asset) => asset.assetKind === 'model').length
  )
  const filteredCount = computed(() => filteredAssets.value.length)
  const totalSize = computed(() =>
    assets.value.reduce((sum, a) => sum + a.fileSize, 0)
  )
  const favoriteCount = computed(() =>
    assets.value.filter((a) => a.isFavorite).length
  )
  const isMultiSelect = computed(() => selectedIds.value.size > 0)

  async function load(): Promise<void> {
    assets.value = await assetRepository.getAll()
  }

  async function scan(): Promise<void> {
    isScanning.value = true
    try {
      await scanService.scanDirectories(settingsStore.settings.scanDirectories)
      await load()
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
    await assetRepository.delete(id)
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
    filteredAssets,
    totalCount,
    packageCount,
    modelCount,
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
