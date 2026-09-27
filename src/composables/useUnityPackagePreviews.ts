import { ref } from 'vue'
import type { Asset } from '../types/asset'
import type { RenderedPreview, RenderedPreviews } from '../platform/backend'
import { packageService } from '../services/packageService'
import { coverService } from '../services/coverService'
import { useAssetStore } from '../stores/assetStore'

/** Previews Unity rendered for a package earlier (from its manifest). */
export function useUnityPackagePreviews(asset: () => Asset) {
  const assets = useAssetStore()
  const previews = ref<RenderedPreviews | null>(null)
  const loading = ref(false)
  const selected = ref<RenderedPreview | null>(null)
  let generation = 0

  async function load(): Promise<void> {
    const current = ++generation
    loading.value = true
    try {
      const result = await packageService.renderedPreviews(asset().filePath)
      if (current === generation) previews.value = result
    } catch {
      if (current === generation) previews.value = null
    } finally {
      if (current === generation) loading.value = false
    }
  }

  async function useAsCover(entry: RenderedPreview): Promise<void> {
    const image = previews.value?.images[entry.preview]
    if (image) await assets.setCover(asset(), coverService.imageFromDataUrl(image))
  }

  function reset(): void {
    generation++
    previews.value = null
    loading.value = false
    selected.value = null
  }

  return { previews, loading, selected, load, useAsCover, reset }
}
