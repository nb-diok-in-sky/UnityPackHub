// Drives the headless Unity instance that renders model covers.
import type { Asset } from '../types/asset'
import { MODEL_PREVIEW_BATCH_SIZE, MODEL_PREVIEW_TIMEOUT_MS } from '../domain/modelCover'
import { createWakeSignal } from '../domain/wakeSignal'
import { appFileUrl, backend, onModelPreviewFinished, onModelPreviewResults } from '../platform/backend'
import { fetchImage } from '../platform/system'

export type ModelCoverOutcome = { assetId: string; image: Blob } | { assetId: string; error: string }

export interface ModelCoverRun {
  editorPath: string
  models: Asset[]
  shaderRulesPath: string
  /** Called once per model, in completion order. */
  onOutcome: (outcome: ModelCoverOutcome) => Promise<void>
  isCancelled: () => boolean
}

/** Results arrive as events; this only matters if file watching is unavailable. */
const SAFETY_CHECK_MS = 5000
const UNITY_EXITED_ERROR =
  'Unity exited before rendering this model. See %APPDATA%/com.unitypackhub.app/Model picture/unity-render.log'
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
  const waiting = new Set(batch.map(({ id }) => id))
  const changed = createWakeSignal()
  let exited = false
  // Listen before starting, so no result written in between is missed.
  const stops = await Promise.all([
    onModelPreviewResults(() => changed.notify()),
    onModelPreviewFinished(() => {
      exited = true
      changed.notify()
    }),
  ])

  const collect = async () => {
    for (const result of await backend.collectModelPreviewResults()) {
      if (!waiting.delete(result.assetId)) continue
      if (!result.success) {
        await run.onOutcome({ assetId: result.assetId, error: result.error || 'Render failed' })
        continue
      }
      try {
        await run.onOutcome({ assetId: result.assetId, image: await fetchImage(appFileUrl(result.imagePath)) })
      } catch (error) {
        await run.onOutcome({ assetId: result.assetId, error: `Failed to read rendered preview: ${String(error)}` })
      }
    }
  }
  const failRemaining = async (error: string) => {
    for (const assetId of waiting) await run.onOutcome({ assetId, error })
    waiting.clear()
  }

  try {
    await backend.startModelPreviewJob(
      run.editorPath,
      batch.map(({ id, filePath }) => ({ assetId: id, sourcePath: filePath })),
      run.shaderRulesPath,
    )
    const deadline = Date.now() + MODEL_PREVIEW_TIMEOUT_MS
    while (waiting.size > 0 && !run.isCancelled()) {
      await changed.wait(Math.min(SAFETY_CHECK_MS, deadline - Date.now()))
      // Read the process state before collecting, so results written just before exit are not lost.
      const running = !exited && (await backend.isModelPreviewJobRunning())
      await collect()
      if (waiting.size === 0) return
      if (!running) return await failRemaining(UNITY_EXITED_ERROR)
      if (Date.now() >= deadline) {
        await backend.cancelModelPreviewJob()
        await collect()
        return await failRemaining(TIMEOUT_ERROR)
      }
    }
  } finally {
    for (const stop of stops) stop()
  }
}
