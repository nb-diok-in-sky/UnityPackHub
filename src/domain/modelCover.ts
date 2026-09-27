import type { Asset, ModelCoverStatus, ModelPreviewState } from '../types/asset'

/** Bump when the renderer changes enough that existing model covers should be redrawn. */
export const MODEL_PREVIEW_VERSION = 4
export const MODEL_PREVIEW_BATCH_SIZE = 20
export const MODEL_PREVIEW_TIMEOUT_MS = 10 * 60 * 1000

export function initialModelPreview(filePath: string): ModelPreviewState {
  return { version: 0, error: '', eligible: isLikelyRenderableModel(filePath) }
}

export function needsModelPreview(asset: Asset): boolean {
  return asset.assetKind === 'model'
    && (asset.modelPreview?.eligible ?? true)
    && (asset.modelPreview?.version ?? 0) < MODEL_PREVIEW_VERSION
}

export function modelCoverStatus(asset: Asset): ModelCoverStatus {
  const preview = asset.modelPreview
  if (preview && !preview.eligible) return 'not-needed'
  if (preview?.version === MODEL_PREVIEW_VERSION && asset.cover === 'stored') return 'completed'
  return preview?.error ? 'failed' : 'pending'
}

/** Animation clips (by folder or naming convention) have no useful still image. */
function isLikelyRenderableModel(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase()
  const name = normalized.split('/').pop() ?? ''
  const isAnimationDirectory = /\/(animation|animations|anim|motion|motions)\//.test(normalized)
  const isAnimationName = /^@/.test(name)
    || /(^|[_-])(idle|walk|run|attack|skill|motion|anim|strafing|meditate|pickup|greet)([_-]|\.)/.test(name)
  return !(isAnimationDirectory || isAnimationName)
}

/** A render result that proves the file has nothing to draw; stop retrying it. */
export function isPermanentRenderFailure(error: string): boolean {
  return error.includes('No renderable mesh')
}
