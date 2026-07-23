import type { Asset, ModelCoverStatus } from '../types/asset'
import { useAssetStore } from '../stores/assetStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useThumbnailStore } from '../stores/thumbnailStore'
import { commands, type ModelPreviewResult } from './tauriCommands'
import {
  MODEL_PREVIEW_BATCH_SIZE,
  MODEL_PREVIEW_TIMEOUT_MS,
  MODEL_PREVIEW_VERSION,
} from './modelPreviewConstants'

export { MODEL_PREVIEW_VERSION } from './modelPreviewConstants'

let generationRunning = false
let cancellationRequested = false

export interface ModelPreviewProgress {
  total: number
  completed: number
  succeeded: number
  failed: number
}

type ProgressCallback = (progress: ModelPreviewProgress) => void

export async function cancelModelPreviewGeneration(): Promise<void> {
  cancellationRequested = true
  await commands.cancelModelPreviewJob()
}

export function needsModelPreview(asset: Asset): boolean {
  return asset.assetKind === 'model'
    && asset.modelPreviewEligible !== false
    && (asset.modelPreviewVersion ?? 0) < MODEL_PREVIEW_VERSION
}

export function getModelCoverStatus(asset: Asset): ModelCoverStatus {
  if (asset.modelPreviewEligible === false) return 'not-needed'
  if (asset.modelPreviewVersion === MODEL_PREVIEW_VERSION && asset.thumbnailPath) return 'completed'
  return asset.modelPreviewError ? 'failed' : 'pending'
}

async function applyResult(result: ModelPreviewResult, progress: ModelPreviewProgress): Promise<void> {
  const assetStore = useAssetStore()
  progress.completed++

  if (result.success) {
    try {
      const dataUrl = await commands.readModelPreviewImage(result.imagePath)
      await useThumbnailStore().setFromDataUrl(result.assetId, dataUrl)
      await assetStore.updateAsset(result.assetId, {
        thumbnailPath: 'db',
        modelPreviewVersion: MODEL_PREVIEW_VERSION,
        modelPreviewError: '',
      })
      progress.succeeded++
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await assetStore.updateAsset(result.assetId, {
        modelPreviewError: `Failed to save rendered preview: ${message}`,
      })
      progress.failed++
      console.warn('[ModelPreview] failed to persist preview:', result.assetId, error)
      return
    }
  }

  const error = result.error || 'Render failed'
  await assetStore.updateAsset(result.assetId, {
    modelPreviewError: error,
    ...(error.includes('No renderable mesh') ? { modelPreviewEligible: false } : {}),
  })
  progress.failed++
  console.warn('[ModelPreview] render failed:', result.assetId, error)
}

async function markTimedOut(ids: Set<string>, progress: ModelPreviewProgress): Promise<void> {
  await commands.cancelModelPreviewJob()
  const assetStore = useAssetStore()
  await Promise.all([...ids].map((id) =>
    assetStore.updateAsset(id, { modelPreviewError: 'Preview generation timed out' })
  ))
  progress.completed += ids.size
  progress.failed += ids.size
}

async function processBatch(
  unityEditorPath: string,
  batch: Asset[],
  shaderRulesPath: string,
  progress: ModelPreviewProgress,
  onProgress: ProgressCallback,
): Promise<void> {
  await commands.startModelPreviewJob(
    unityEditorPath,
    batch.map(({ id, filePath }) => ({ assetId: id, sourcePath: filePath })),
    shaderRulesPath,
  )

  const waiting = new Set(batch.map(({ id }) => id))
  const deadline = Date.now() + MODEL_PREVIEW_TIMEOUT_MS
  while (waiting.size && !cancellationRequested) {
    if (Date.now() >= deadline) {
      await markTimedOut(waiting, progress)
      onProgress({ ...progress })
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 1500))
    for (const result of await commands.collectModelPreviewResults()) {
      if (!waiting.delete(result.assetId)) continue
      await applyResult(result, progress)
      onProgress({ ...progress })
    }
  }
}

export async function startModelPreviewGeneration(
  unityEditorPath: string,
  assets: Asset[],
  limit: number,
  onProgress: ProgressCallback,
): Promise<ModelPreviewProgress> {
  if (generationRunning) throw new Error('Model preview generation is already running')
  generationRunning = true
  cancellationRequested = false

  const pending = assets.filter(needsModelPreview).slice(0, Math.max(0, limit))
  const progress: ModelPreviewProgress = {
    total: pending.length,
    completed: 0,
    succeeded: 0,
    failed: 0,
  }
  onProgress({ ...progress })

  try {
    const shaderRulesPath = useSettingsStore().settings.shaderAdapters.rulesPath
    for (let offset = 0; offset < pending.length && !cancellationRequested; offset += MODEL_PREVIEW_BATCH_SIZE) {
      await processBatch(
        unityEditorPath,
        pending.slice(offset, offset + MODEL_PREVIEW_BATCH_SIZE),
        shaderRulesPath,
        progress,
        onProgress,
      )
    }
    return progress
  } finally {
    generationRunning = false
  }
}
