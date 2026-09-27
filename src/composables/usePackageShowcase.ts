import { computed, onUnmounted, ref } from 'vue'
import type { Asset } from '../types/asset'
import type { PackageAssetEntry, PackageAssetList } from '../platform/backend'
import { packageService } from '../services/packageService'
import { errorMessage } from '../ui/feedback'

export const PACKAGE_SHOWCASE_TYPES = ['Prefab', 'Texture', 'Script'] as const
export type PackageShowcaseType = (typeof PACKAGE_SHOWCASE_TYPES)[number]

const RENDER_POLL_INTERVAL_MS = 3000
const RENDER_POLL_LIMIT = 60

/**
 * Detail section listing a package's prefabs, textures and scripts. Opening it asks the Unity
 * bridge to render missing prefab previews and picks new images up while it stays open.
 */
export function usePackageShowcase(asset: () => Asset) {
  const listing = ref<PackageAssetList | null>(null)
  const loading = ref(false)
  const error = ref('')
  const open = ref(false)
  const filter = ref<'All' | PackageShowcaseType>('All')
  const images = ref<Record<string, string>>({})
  const outputFiles = ref<Record<string, string>>({})
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let generation = 0

  const entries = computed(() => listing.value?.entries.filter((entry) =>
    (PACKAGE_SHOWCASE_TYPES as readonly string[]).includes(entry.assetType)) ?? [])
  const filteredEntries = computed(() => (filter.value === 'All' ? entries.value : entries.value.filter((entry) => entry.assetType === filter.value)))
  const typeCounts = computed(() => Object.fromEntries(['All', ...PACKAGE_SHOWCASE_TYPES].map((type) =>
    [type, type === 'All' ? entries.value.length : entries.value.filter((entry) => entry.assetType === type).length])))

  /** Unity render for prefabs, else the preview embedded in the package. */
  function thumbnail(entry: PackageAssetEntry): string | null {
    const rendered = entry.assetType === 'Prefab' ? images.value[outputFiles.value[entry.pathname] ?? ''] : undefined
    return rendered ?? entry.preview
  }

  function stopPolling(): void {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
  }

  function pollRenders(current: number, remaining: number): void {
    stopPolling()
    const missing = Object.values(outputFiles.value).some((file) => !(file in images.value))
    if (!missing || remaining <= 0) return
    pollTimer = setTimeout(async () => {
      if (current !== generation || !open.value) return
      try {
        const latest = await packageService.readPreviewImages(asset().filePath)
        if (current !== generation) return
        if (Object.keys(latest).length !== Object.keys(images.value).length) images.value = latest
      } catch {
        return
      }
      pollRenders(current, remaining - 1)
    }, RENDER_POLL_INTERVAL_MS)
  }

  async function load(refresh = false): Promise<void> {
    const current = ++generation
    stopPolling()
    loading.value = true
    error.value = ''
    try {
      const path = asset().filePath
      const parsed = await packageService.listAssets(path, { refresh })
      if (current !== generation) return
      listing.value = parsed
      const folder = await packageService.requestPreviews(path, parsed)
      if (current !== generation) return
      outputFiles.value = folder.outputFiles
      images.value = folder.images
      pollRenders(current, RENDER_POLL_LIMIT)
    } catch (reason) {
      if (current === generation) error.value = errorMessage(reason)
    } finally {
      if (current === generation) loading.value = false
    }
  }

  async function toggle(): Promise<void> {
    if (open.value) {
      open.value = false
      stopPolling()
      return
    }
    open.value = true
    await load()
  }

  function reset(): void {
    generation++
    stopPolling()
    listing.value = null
    loading.value = false
    error.value = ''
    open.value = false
    filter.value = 'All'
    images.value = {}
    outputFiles.value = {}
  }

  async function clearPreviews(): Promise<void> {
    await packageService.clearAllPreviews()
    reset()
  }

  onUnmounted(stopPolling)

  return { listing, loading, error, open, filter, entries, filteredEntries, typeCounts, thumbnail, load, toggle, clearPreviews, reset }
}
