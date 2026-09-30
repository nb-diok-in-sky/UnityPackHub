import { onUnmounted, ref } from 'vue'
import type { Asset } from '../types/asset'
import type { RenderedPreview, RenderedPreviews } from '../platform/backend'
import { packageService } from '../services/packageService'
import { coverService } from '../services/coverService'
import { useAssetStore } from '../stores/assetStore'

/** Previews Unity rendered for a package (from its manifest); refreshes when Unity renders more. */
export function useUnityPackagePreviews(asset: () => Asset) {
  const assets = useAssetStore()
  const previews = ref<RenderedPreviews | null>(null)
  const loading = ref(false)
  const selected = ref<RenderedPreview | null>(null)
  const version = ref(0)
  let stopWatching: (() => void) | null = null
  let generation = 0

  async function fetchManifest(current: number): Promise<void> {
    const result = await packageService.renderedPreviews(asset().filePath).catch(() => null)
    if (current !== generation) return
    previews.value = result
    version.value++
  }

  async function load(): Promise<void> {
    const current = ++generation
    loading.value = true
    stopWatching?.()
    try {
      await fetchManifest(current)
      const stop = await packageService.onPreviewsChanged(asset().filePath, () => {
        void fetchManifest(current)
      })
      if (current === generation) stopWatching = stop
      else stop()
    } finally {
      if (current === generation) loading.value = false
    }
  }

  function imageUrl(entry: RenderedPreview): string {
    return previews.value ? packageService.previewUrl(previews.value.path, entry.preview, version.value) : ''
  }

  async function useAsCover(entry: RenderedPreview): Promise<void> {
    if (previews.value) await assets.setCover(asset(), await coverService.imageFromPageUrl(imageUrl(entry)))
  }

  function reset(): void {
    generation++
    stopWatching?.()
    stopWatching = null
    previews.value = null
    loading.value = false
    selected.value = null
  }

  onUnmounted(reset)

  return { previews, loading, selected, imageUrl, load, useAsCover, reset }
}
