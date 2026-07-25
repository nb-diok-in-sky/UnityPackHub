import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { assetRepository, thumbnailRepository } from '../services/repositories'

const MAX_CACHED_THUMBNAILS = 200

export const useThumbnailStore = defineStore('thumbnails', () => {
  const urls = reactive(new Map<string, string>())
  const loading = new Map<string, Promise<string | undefined>>()

  async function loadAll(): Promise<void> {
    await migrateDataUrls()
  }

  async function load(assetId: string): Promise<string | undefined> {
    const cached = urls.get(assetId)
    if (cached) {
      touch(assetId, cached)
      return cached
    }

    const pending = loading.get(assetId)
    if (pending) return pending

    const request = thumbnailRepository.get(assetId).then((record) => {
      if (!record) return undefined
      const url = URL.createObjectURL(record.blob)
      urls.set(assetId, url)
      evictOverflow()
      return url
    }).finally(() => loading.delete(assetId))
    loading.set(assetId, request)
    return request
  }

  async function migrateDataUrls(): Promise<void> {
    const assets = await assetRepository.getAll()
    const migrations: Array<Promise<void>> = []
    for (const asset of assets) {
      if (asset.thumbnailPath && asset.thumbnailPath.startsWith('data:')) {
        migrations.push((async () => {
          try {
          const resp = await fetch(asset.thumbnailPath)
          const blob = await resp.blob()
          await thumbnailRepository.save(asset.id, blob)
          await assetRepository.update(asset.id, { thumbnailPath: 'db' })
          } catch {
            // Keep the legacy data URL when migration cannot be completed.
          }
        })())
      }
    }
    await Promise.all(migrations)
  }

  function getUrl(assetId: string): string | undefined {
    return urls.get(assetId)
  }

  function touch(assetId: string, url: string): void {
    urls.delete(assetId)
    urls.set(assetId, url)
  }

  function evictOverflow(): void {
    while (urls.size > MAX_CACHED_THUMBNAILS) {
      const oldestId = urls.keys().next().value as string | undefined
      if (!oldestId) return
      const url = urls.get(oldestId)
      if (url) URL.revokeObjectURL(url)
      urls.delete(oldestId)
    }
  }

  async function setFromDataUrl(assetId: string, dataUrl: string): Promise<void> {
    const resp = await fetch(dataUrl)
    const blob = await resp.blob()
    await setFromBlob(assetId, blob)
  }

  async function setFromBlob(assetId: string, blob: Blob): Promise<void> {
    await thumbnailRepository.save(assetId, blob)
    if (urls.has(assetId)) URL.revokeObjectURL(urls.get(assetId)!)
    urls.set(assetId, URL.createObjectURL(blob))
  }

  async function remove(assetId: string): Promise<void> {
    await thumbnailRepository.delete(assetId)
    if (urls.has(assetId)) {
      URL.revokeObjectURL(urls.get(assetId)!)
      urls.delete(assetId)
    }
  }

  async function removeMany(assetIds: string[]): Promise<void> {
    await thumbnailRepository.deleteMany(assetIds)
    for (const id of assetIds) {
      if (urls.has(id)) {
        URL.revokeObjectURL(urls.get(id)!)
        urls.delete(id)
      }
    }
  }

  return { urls, loadAll, load, getUrl, setFromDataUrl, setFromBlob, remove, removeMany }
})
