import { ref, type Ref } from 'vue'
import type { Asset } from '../types/asset'
import { setFavorite } from '../domain/assetChanges'
import { assetStoreSearchUrl } from '../domain/assetStore'
import { fileService } from '../services/fileService'
import { unityService } from '../services/unityService'
import { useAssetStore } from '../stores/assetStore'
import { useI18n } from '../i18n'
import { errorMessage } from '../ui/feedback'
import { unityErrorText } from './unityErrorText'

/** Buttons of the detail drawer; results are reported through `status`. */
export function useAssetDetailActions(asset: Ref<Asset | null>) {
  const assets = useAssetStore()
  const { t, tr } = useI18n()
  const isImporting = ref(false)
  const isLocating = ref(false)
  const status = ref('')

  async function toggleFavorite(): Promise<void> {
    if (asset.value) await assets.edit([asset.value.id], setFavorite(!asset.value.isFavorite))
  }

  async function importAsset(): Promise<void> {
    if (!asset.value || isImporting.value) return
    isImporting.value = true
    status.value = ''
    try {
      const result = await assets.importToUnity(asset.value)
      if (result.projectPath) status.value = result.bridgeInstalled ? t.bridgeInjected : t.bridgeDetected
    } catch (error) {
      status.value = tr('importFailed', { reason: errorMessage(error) })
    } finally {
      isImporting.value = false
    }
  }

  async function locateInUnity(): Promise<void> {
    if (!asset.value || isLocating.value) return
    isLocating.value = true
    status.value = ''
    try {
      const path = await unityService.highlightFile(asset.value.filePath)
      status.value = tr('unityHighlighted', { path: path || asset.value.fileName })
    } catch (error) {
      status.value = unityErrorText(error)
    } finally {
      isLocating.value = false
    }
  }

  return {
    isImporting,
    isLocating,
    status,
    toggleFavorite,
    importAsset,
    locateInUnity,
    revealFile: async () => { if (asset.value) await fileService.reveal(asset.value.filePath) },
    searchUnityStore: async () => { if (asset.value) await fileService.openUrl(assetStoreSearchUrl(asset.value.name)) },
    resetStatus: () => { status.value = '' },
  }
}
