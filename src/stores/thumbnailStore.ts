import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { db } from '../services/database'

export const useThumbnailStore = defineStore('thumbnails', () => {
  const urls = reactive(new Map<string, string>())

  async function loadAll(): Promise<void> {
    const records = await db.thumbnails.toArray()
    for (const rec of records) {
      if (urls.has(rec.id)) URL.revokeObjectURL(urls.get(rec.id)!)
      urls.set(rec.id, URL.createObjectURL(rec.blob))
    }

    await migrateDataUrls()
  }

  async function migrateDataUrls(): Promise<void> {
    const assets = await db.assets.toArray()
    for (const asset of assets) {
      if (asset.thumbnailPath && asset.thumbnailPath.startsWith('data:')) {
        try {
          const resp = await fetch(asset.thumbnailPath)
          const blob = await resp.blob()
          await db.thumbnails.put({ id: asset.id, blob })
          await db.assets.update(asset.id, { thumbnailPath: 'db' })
          urls.set(asset.id, URL.createObjectURL(blob))
        } catch {
          urls.set(asset.id, asset.thumbnailPath)
        }
      } else if (asset.thumbnailPath === 'db' && !urls.has(asset.id)) {
        await db.assets.update(asset.id, { thumbnailPath: '' })
      }
    }
  }

  function getUrl(assetId: string): string | undefined {
    return urls.get(assetId)
  }

  async function setFromDataUrl(assetId: string, dataUrl: string): Promise<void> {
    const resp = await fetch(dataUrl)
    const blob = await resp.blob()
    await setFromBlob(assetId, blob)
  }

  async function setFromBlob(assetId: string, blob: Blob): Promise<void> {
    await db.thumbnails.put({ id: assetId, blob })
    if (urls.has(assetId)) URL.revokeObjectURL(urls.get(assetId)!)
    urls.set(assetId, URL.createObjectURL(blob))
  }

  async function remove(assetId: string): Promise<void> {
    await db.thumbnails.delete(assetId)
    if (urls.has(assetId)) {
      URL.revokeObjectURL(urls.get(assetId)!)
      urls.delete(assetId)
    }
  }

  async function removeMany(assetIds: string[]): Promise<void> {
    await db.thumbnails.bulkDelete(assetIds)
    for (const id of assetIds) {
      if (urls.has(id)) {
        URL.revokeObjectURL(urls.get(id)!)
        urls.delete(id)
      }
    }
  }

  return { urls, loadAll, getUrl, setFromDataUrl, setFromBlob, remove, removeMany }
})
