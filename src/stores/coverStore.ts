import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { coverService } from '../services/coverService'

// Object URLs hold decoded images in memory, so only recently shown covers stay loaded. The
// limit must exceed what a large window shows at once, or visible covers evict each other.
const MAX_LOADED_COVERS = 600

/** Object URLs of cover blobs, loaded on demand and evicted least-recently-used first. */
export const useCoverStore = defineStore('covers', () => {
  const urls = reactive(new Map<string, string>())
  const pending = new Map<string, Promise<void>>()

  function remember(assetId: string, url: string): void {
    const previous = urls.get(assetId)
    if (previous && previous !== url) URL.revokeObjectURL(previous)
    urls.delete(assetId)
    urls.set(assetId, url)
    while (urls.size > MAX_LOADED_COVERS) {
      const [oldestId, oldestUrl] = urls.entries().next().value as [string, string]
      URL.revokeObjectURL(oldestUrl)
      urls.delete(oldestId)
    }
  }

  /** Loads the stored cover of an asset if it is not in memory yet. */
  function ensure(assetId: string): Promise<void> {
    if (urls.has(assetId)) return Promise.resolve()
    const running = pending.get(assetId)
    if (running) return running
    const request = coverService
      .load(assetId)
      .then((blob) => {
        if (blob) remember(assetId, URL.createObjectURL(blob))
      })
      .finally(() => pending.delete(assetId))
    pending.set(assetId, request)
    return request
  }

  async function save(assetId: string, image: Blob): Promise<void> {
    await coverService.save(assetId, image)
    remember(assetId, URL.createObjectURL(image))
  }

  async function remove(assetId: string): Promise<void> {
    await coverService.remove(assetId)
    const url = urls.get(assetId)
    if (url) URL.revokeObjectURL(url)
    urls.delete(assetId)
  }

  /** Forgets every loaded cover, e.g. after the library was replaced by a backup. */
  function clear(): void {
    for (const url of urls.values()) URL.revokeObjectURL(url)
    urls.clear()
  }

  return { url: (assetId: string) => urls.get(assetId), ensure, save, remove, clear }
})
