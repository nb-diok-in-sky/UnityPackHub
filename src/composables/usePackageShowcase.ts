import { computed, onUnmounted, ref } from 'vue'
import type { Asset } from '../types/asset'
import type { PackageAssetEntry, PackageAssetList } from '../platform/backend'
import { PackageFileMissingError, packageService } from '../services/packageService'
import { errorMessage } from '../ui/feedback'

export const PACKAGE_SHOWCASE_TYPES = ['Prefab', 'Texture', 'Script'] as const
export type PackageShowcaseType = (typeof PACKAGE_SHOWCASE_TYPES)[number]

/**
 * Detail section listing a package's prefabs, textures and scripts. Opening it asks the Unity
 * bridge to render missing prefab previews; new renders show up as Unity writes them.
 */
export function usePackageShowcase(asset: () => Asset) {
  const listing = ref<PackageAssetList | null>(null)
  const loading = ref(false)
  const error = ref('')
  /** The package file itself is gone; shown as a hint instead of an error. */
  const missing = ref(false)
  const open = ref(false)
  const filter = ref<'All' | PackageShowcaseType>('All')
  const folder = ref('')
  const renderedFiles = ref<ReadonlySet<string>>(new Set())
  const outputFiles = ref<Record<string, string>>({})
  /** Bumped on every re-render so `<img>` reloads files that kept their name. */
  const renderVersion = ref(0)
  let stopWatching: (() => void) | null = null
  let generation = 0

  const entries = computed(
    () =>
      listing.value?.entries.filter((entry) =>
        (PACKAGE_SHOWCASE_TYPES as readonly string[]).includes(entry.assetType),
      ) ?? [],
  )
  const filteredEntries = computed(() =>
    filter.value === 'All' ? entries.value : entries.value.filter((entry) => entry.assetType === filter.value),
  )
  const typeCounts = computed(() =>
    Object.fromEntries(
      ['All', ...PACKAGE_SHOWCASE_TYPES].map((type) => [
        type,
        type === 'All' ? entries.value.length : entries.value.filter((entry) => entry.assetType === type).length,
      ]),
    ),
  )

  /** Unity render for prefabs, else the preview embedded in the package. */
  function thumbnail(entry: PackageAssetEntry): string | null {
    const rendered = entry.assetType === 'Prefab' ? outputFiles.value[entry.pathname] : undefined
    if (rendered && renderedFiles.value.has(rendered))
      return packageService.previewUrl(folder.value, rendered, renderVersion.value)
    return packageService.embeddedPreviewUrl(entry.previewPath)
  }

  function unwatch(): void {
    stopWatching?.()
    stopWatching = null
  }

  async function watchRenders(path: string, current: number): Promise<void> {
    unwatch()
    const stop = await packageService.onPreviewsChanged(path, async () => {
      const files = await packageService.listPreviewFiles(path)
      if (current !== generation) return
      renderedFiles.value = new Set(files)
      renderVersion.value++
    })
    if (current === generation && open.value) stopWatching = stop
    else stop()
  }

  async function load(refresh = false): Promise<void> {
    const current = ++generation
    loading.value = true
    error.value = ''
    missing.value = false
    try {
      const path = asset().filePath
      const parsed = await packageService.listAssets(path, { refresh })
      if (current !== generation) return
      listing.value = parsed
      const previews = await packageService.requestPreviews(path, parsed)
      if (current !== generation) return
      folder.value = previews.path
      outputFiles.value = previews.outputFiles
      renderedFiles.value = new Set(previews.files)
      await watchRenders(path, current)
    } catch (reason) {
      if (current !== generation) return
      if (reason instanceof PackageFileMissingError) missing.value = true
      else error.value = errorMessage(reason)
    } finally {
      if (current === generation) loading.value = false
    }
  }

  async function toggle(): Promise<void> {
    if (open.value) {
      open.value = false
      unwatch()
      return
    }
    open.value = true
    await load()
  }

  function reset(): void {
    generation++
    unwatch()
    listing.value = null
    loading.value = false
    error.value = ''
    missing.value = false
    open.value = false
    filter.value = 'All'
    folder.value = ''
    renderedFiles.value = new Set()
    outputFiles.value = {}
  }

  async function clearPreviews(): Promise<void> {
    await packageService.clearAllPreviews()
    reset()
  }

  onUnmounted(unwatch)

  return {
    listing,
    loading,
    error,
    missing,
    open,
    filter,
    entries,
    filteredEntries,
    typeCounts,
    thumbnail,
    load,
    toggle,
    clearPreviews,
    reset,
  }
}
