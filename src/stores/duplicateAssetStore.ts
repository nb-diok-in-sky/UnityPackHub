import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Asset } from '../types/asset'
import { commands } from '../services/tauriCommands'

export const useDuplicateAssetStore = defineStore('duplicateAssets', () => {
  const scanning = ref(false)
  const duplicateIdsByAssetId = ref<Record<string, string[]>>({})

  async function scan(assets: Asset[]): Promise<void> {
    scanning.value = true
    try {
      const models = assets.filter((asset) => asset.assetKind === 'model')
      const bySize = new Map<number, Asset[]>()
      for (const asset of models) bySize.set(asset.fileSize, [...(bySize.get(asset.fileSize) ?? []), asset])
      const candidates = [...bySize.values()].filter((group) => group.length > 1).flat()
      const results = []
      const batchSize = 100
      for (let offset = 0; offset < candidates.length; offset += batchSize) {
        results.push(...await commands.hashFiles(candidates.slice(offset, offset + batchSize).map((asset) => asset.filePath)))
      }
      const assetByPath = new Map(candidates.map((asset) => [asset.filePath, asset]))
      const byHash = new Map<string, Asset[]>()
      for (const result of results) {
        if (!result.hash) continue
        const asset = assetByPath.get(result.filePath)
        if (asset) byHash.set(result.hash, [...(byHash.get(result.hash) ?? []), asset])
      }
      const duplicates: Record<string, string[]> = {}
      for (const group of byHash.values()) {
        if (group.length < 2) continue
        for (const asset of group) duplicates[asset.id] = group.filter((item) => item.id !== asset.id).map((item) => item.id)
      }
      duplicateIdsByAssetId.value = duplicates
    } finally {
      scanning.value = false
    }
  }

  function getDuplicateIds(assetId: string): string[] { return duplicateIdsByAssetId.value[assetId] ?? [] }
  return { scanning, duplicateIdsByAssetId, scan, getDuplicateIds }
})
