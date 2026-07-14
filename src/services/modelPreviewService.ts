import { commands } from './tauriCommands'
import type { Asset } from '../types/asset'
import { useThumbnailStore } from '../stores/thumbnailStore'
import { useAssetStore } from '../stores/assetStore'

export interface ModelPreviewProgress {
  total: number
  completed: number
  succeeded: number
  failed: number
}

export async function startModelPreviewGeneration(
  unityEditorPath: string,
  assets: Asset[],
  limit: number,
  onProgress: (progress: ModelPreviewProgress) => void,
): Promise<ModelPreviewProgress> {
  const thumbnailStore = useThumbnailStore()
  const assetStore = useAssetStore()
  const pending = assets
    .filter((asset) =>
      asset.assetKind === 'model' && !asset.thumbnailPath && !thumbnailStore.getUrl(asset.id)
    )
    .slice(0, Math.max(0, limit))
  const progress: ModelPreviewProgress = { total: pending.length, completed: 0, succeeded: 0, failed: 0 }
  onProgress({ ...progress })
  if (pending.length === 0) return progress

  await commands.startModelPreviewJob(
    unityEditorPath,
    pending.map((asset) => ({ assetId: asset.id, sourcePath: asset.filePath })),
  )

  const waiting = new Set(pending.map((asset) => asset.id))
  while (waiting.size > 0) {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const results = await commands.collectModelPreviewResults()
    for (const result of results) {
      if (!waiting.delete(result.assetId)) continue
      progress.completed++
      if (result.success) {
        const dataUrl = await commands.readModelPreviewImage(result.imagePath)
        await thumbnailStore.setFromDataUrl(result.assetId, dataUrl)
        await assetStore.updateAsset(result.assetId, { thumbnailPath: 'db' })
        progress.succeeded++
      } else {
        progress.failed++
        console.warn('[ModelPreview] render failed:', result.assetId, result.error)
      }
      onProgress({ ...progress })
    }
  }
  return progress
}
