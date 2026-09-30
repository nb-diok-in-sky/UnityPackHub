import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AssetKind, ModelCoverFilter } from '../types/asset'
import { queryAssets, searchText } from '../domain/assetQuery'
import { modelCoverStatus } from '../domain/modelCover'
import { isAssetAvailable } from '../domain/paths'
import { useAssetStore } from './assetStore'
import { useGroupStore } from './groupStore'
import { useSettingsStore } from './settingsStore'
import { useTagStore } from './tagStore'
import { useUnityProjectStore } from './unityProjectStore'

/** What the grid shows: asset kind, filters, search, selection and tag painting. */
export const useBrowseStore = defineStore('browse', () => {
  const assets = useAssetStore()
  const tags = useTagStore()
  const groups = useGroupStore()
  const settings = useSettingsStore()
  const project = useUnityProjectStore()

  const kind = ref<AssetKind>('package')
  const search = ref('')
  const favoritesOnly = ref(false)
  const activeTagId = ref<string | null>(null)
  const activeGroupId = ref<string | null>(null)
  const modelCover = ref<ModelCoverFilter>('all')
  const selectedIds = ref<Set<string>>(new Set())
  const paintingTagId = ref<string | null>(null)
  let anchorId: string | null = null

  /** Assets of enabled, reachable scan folders; the rest stay in the database but are hidden. */
  const libraryAssets = computed(() => {
    const enabled = settings.settings.scanDirectories.filter((directory) => directory.enabled).map((directory) => directory.path)
    return assets.assets.filter((asset) => isAssetAvailable(asset, enabled))
  })
  const statistics = computed(() => {
    const counts = { package: 0, model: 0, pending: 0, completed: 0, failed: 0, 'not-needed': 0 }
    for (const asset of libraryAssets.value) {
      counts[asset.assetKind]++
      if (asset.assetKind === 'model') counts[modelCoverStatus(asset)]++
    }
    return counts
  })
  const searchIndex = computed(() => new Map(libraryAssets.value.map((asset) => [asset.id, searchText(asset, tags.tagMap)])))
  const kindAssets = computed(() => libraryAssets.value.filter((asset) => asset.assetKind === kind.value))
  const visibleAssets = computed(() => {
    const group = groups.groups.find((current) => current.id === activeGroupId.value)
    return queryAssets(libraryAssets.value, {
      kind: kind.value,
      search: search.value,
      favoritesOnly: favoritesOnly.value,
      tagId: activeTagId.value,
      groupAssetIds: group ? new Set(group.assetIds) : null,
      modelCover: modelCover.value,
      project: project.isSynchronized ? { filter: project.filter, stateOf: project.stateOf } : null,
      sortBy: settings.settings.sortBy,
      sortOrder: settings.settings.sortOrder,
    }, (asset) => searchIndex.value.get(asset.id) ?? '')
  })

  /** Sidebar filters are exclusive: favourites, one tag or one group. */
  function showAll(): void {
    favoritesOnly.value = false
    activeTagId.value = null
    activeGroupId.value = null
  }

  /** Clears every filter, including search and the cover status filter. */
  function resetFilters(): void {
    showAll()
    search.value = ''
    modelCover.value = 'all'
    project.setFilter('all')
  }

  function setKind(value: AssetKind): void {
    kind.value = value
    showAll()
    modelCover.value = 'all'
    clearSelection()
  }

  function showFavorites(): void { showAll(); favoritesOnly.value = true }
  function toggleTag(id: string): void { const next = activeTagId.value === id ? null : id; showAll(); activeTagId.value = next }
  function toggleGroup(id: string): void { const next = activeGroupId.value === id ? null : id; showAll(); activeGroupId.value = next }
  function showGroup(id: string | null): void { showAll(); activeGroupId.value = id }
  function setModelCover(value: ModelCoverFilter): void { modelCover.value = value; clearSelection() }

  function toggleSelected(id: string): void {
    const next = new Set(selectedIds.value)
    if (!next.delete(id)) next.add(id)
    selectedIds.value = next
    anchorId = id
  }

  /** Shift+click: selects everything between the last clicked card and this one. */
  function selectRange(id: string): void {
    const list = visibleAssets.value
    const to = list.findIndex((asset) => asset.id === id)
    const from = anchorId ? list.findIndex((asset) => asset.id === anchorId) : -1
    if (to === -1) return
    if (from === -1) return toggleSelected(id)
    const next = new Set(selectedIds.value)
    for (const asset of list.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(asset.id)
    selectedIds.value = next
    anchorId = id
  }

  function selectAll(): void { selectedIds.value = new Set(visibleAssets.value.map((asset) => asset.id)) }
  function clearSelection(): void { selectedIds.value = new Set() }

  function togglePainting(tagId: string): void { paintingTagId.value = paintingTagId.value === tagId ? null : tagId }
  function stopPainting(): void { paintingTagId.value = null }

  return {
    kind,
    search,
    favoritesOnly,
    activeTagId,
    activeGroupId,
    modelCover,
    selectedIds,
    paintingTagId,
    libraryAssets,
    statistics,
    /** Assets kept in the database but hidden (folder disabled or unreachable). */
    hiddenCount: computed(() => assets.assets.length - libraryAssets.value.length),
    /** The selected group, when it is one the user manages (not a classification). */
    activeManualGroup: computed(() => groups.manualGroups.find((group) => group.id === activeGroupId.value) ?? null),
    kindAssets,
    visibleAssets,
    hasSelection: computed(() => selectedIds.value.size > 0),
    favoriteCount: computed(() => kindAssets.value.filter((asset) => asset.isFavorite).length),
    totalSize: computed(() => kindAssets.value.reduce((sum, asset) => sum + asset.fileSize, 0)),
    setKind,
    showAll,
    resetFilters,
    showFavorites,
    toggleTag,
    toggleGroup,
    showGroup,
    setModelCover,
    toggleSelected,
    selectRange,
    selectAll,
    clearSelection,
    togglePainting,
    stopPainting,
  }
})
