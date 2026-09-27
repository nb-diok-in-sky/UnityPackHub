// Drives the headless Unity instance that renders model covers.
import type { Asset } from '../types/asset'
import { MODEL_PREVIEW_BATCH_SIZE, MODEL_PREVIEW_TIMEOUT_MS } from '../domain/modelCover'
import { dataUrlToBlob } from '../domain/legacyRecords'
import { backend } from '../platform/backend'

export type ModelCoverOutcome =
  | { assetId: string; image: Blob }
  | { assetId: string; error: string }

export interface ModelCoverRun {
  editorPath: string
  models: Asset[]
  shaderRulesPath: string
  /** Called once per model, in completion order. */
  onOutcome: (outcome: ModelCoverOutcome) => Promise<void>
  isCancelled: () => boolean
}

const POLL_INTERVAL_MS = 1500
const UNITY_EXITED_ERROR = 'Unity exited before rendering this model. See %APPDATA%/com.unitypackhub.app/Model picture/unity-render.log'
const TIMEOUT_ERROR = 'Preview generation timed out'

export const modelPreviewService = {
  /** Renders in batches of MODEL_PREVIEW_BATCH_SIZE so one Unity crash loses at most one batch. */
  async run(run: ModelCoverRun): Promise<void> {
    for (let offset = 0; offset < run.models.length && !run.isCancelled(); offset += MODEL_PREVIEW_BATCH_SIZE) {
      await runBatch(run, run.models.slice(offset, offset + MODEL_PREVIEW_BATCH_SIZE))
    }
  },

  cancel: (): Promise<boolean> => backend.cancelModelPreviewJob(),
}

async function runBatch(run: ModelCoverRun, batch: Asset[]): Promise<void> {
  await backend.startModelPreviewJob(run.editorPath, batch.map(({ id, filePath }) => ({ assetId: id, sourcePath: filePath })), run.shaderRulesPath)
  const waiting = new Set(batch.map(({ id }) => id))
  const deadline = Date.now() + MODEL_PREVIEW_TIMEOUT_MS

  const collect = async () => {
    for (const result of await backend.collectModelPreviewResults()) {
      if (!waiting.delete(result.assetId)) continue
      if (!result.success) {
        await run.onOutcome({ assetId: result.assetId, error: result.error || 'Render failed' })
        continue
      }
      try {
        const image = dataUrlToBlob(await backend.readImageFile(result.imagePath))
        await run.onOutcome({ assetId: result.assetId, image })
      } catch (error) {
        await run.onOutcome({ assetId: result.assetId, error: `Failed to read rendered preview: ${String(error)}` })
      }
    }
  }
  const failRemaining = async (error: string) => {
    for (const assetId of waiting) await run.onOutcome({ assetId, error })
    waiting.clear()
  }

  while (waiting.size > 0 && !run.isCancelled()) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    // Read the process state before collecting, so results written just before exit are not lost.
    const running = await backend.isModelPreviewJobRunning()
    await collect()
    if (waiting.size === 0) return
    if (!running) return failRemaining(UNITY_EXITED_ERROR)
    if (Date.now() >= deadline) {
      await backend.cancelModelPreviewJob()
      await collect()
      return failRemaining(TIMEOUT_ERROR)
    }
  }
}
