import { ref, type Ref } from 'vue'
import { open } from '@tauri-apps/plugin-shell'
import type { Asset } from '../types/asset'
import { useAssetStore } from '../stores/assetStore'
import { useI18n } from '../services/i18n'
import { detectUnityProject, highlightInUnity, importToUnity, openFileLocation } from '../services/unityImporter'

function stripVersionSuffix(name: string): string {
  return name.replace(/[\s_-]*v?\d+(\.\d+){0,3}[\s_-]*$/i, '').trim()
}

export function useAssetDetailActions(asset: Ref<Asset | null>) {
  const assetStore = useAssetStore()
  const { t } = useI18n()
  const isImporting = ref(false)
  const isLocatingInUnity = ref(false)
  const status = ref('')

  async function toggleFavorite(): Promise<void> {
    if (asset.value) await assetStore.toggleFavorite(asset.value.id)
  }

  async function importAsset(): Promise<void> {
    if (!asset.value || isImporting.value) return
    isImporting.value = true
    status.value = ''
    try {
      const projectPath = await detectUnityProject()
      const result = await importToUnity(asset.value.filePath, projectPath ?? undefined)
      if (!result.success) {
        status.value = result.message
        return
      }
      if (projectPath) status.value = result.newlyInjected ? t.bridgeInjected : t.bridgeDetected
    } finally {
      isImporting.value = false
    }
  }

  async function revealFile(): Promise<void> {
    if (asset.value) await openFileLocation(asset.value.filePath)
  }

  async function locateInUnity(): Promise<void> {
    if (!asset.value || isLocatingInUnity.value) return
    isLocatingInUnity.value = true
    status.value = ''
    try {
      const result = await highlightInUnity(asset.value.filePath)
      status.value = result.success
        ? `Unity 已高亮：${result.assetPath ?? asset.value.fileName}`
        : result.message
    } finally {
      isLocatingInUnity.value = false
    }
  }

  async function searchUnityStore(): Promise<void> {
    if (!asset.value) return
    const query = encodeURIComponent(stripVersionSuffix(asset.value.name))
    await open(`https://assetstore.unity.com/?q=${query}&orderBy=1`)
  }

  function resetStatus(): void {
    status.value = ''
  }

  return {
    isImporting,
    isLocatingInUnity,
    status,
    toggleFavorite,
    importAsset,
    revealFile,
    locateInUnity,
    searchUnityStore,
    resetStatus,
  }
}
