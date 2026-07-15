import type { Asset } from '../types/asset'
import { useAssetStore } from '../stores/assetStore'
import { useThumbnailStore } from '../stores/thumbnailStore'
import { MODEL_PREVIEW_VERSION } from './modelPreviewConstants'

async function markCurrent(asset: Asset): Promise<void> {
  await useAssetStore().updateAsset(asset.id, {
    thumbnailPath: 'db',
    modelPreviewVersion: MODEL_PREVIEW_VERSION,
    modelPreviewError: '',
  })
}

export async function setAssetCoverFromBlob(asset: Asset, blob: Blob): Promise<void> {
  await useThumbnailStore().setFromBlob(asset.id, blob)
  await markCurrent(asset)
}

export async function setAssetCoverFromDataUrl(asset: Asset, dataUrl: string): Promise<void> {
  await useThumbnailStore().setFromDataUrl(asset.id, dataUrl)
  await markCurrent(asset)
}

