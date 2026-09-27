import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { UnityAssetProjectState, UnityProjectFilter } from '../types/asset'
import { unityService } from '../services/unityService'
import { modelFilesService } from '../services/modelFilesService'
import { useAssetStore } from './assetStore'

/** Link state between library models and the open Unity project, plus content duplicates. */
export const useUnityProjectStore = defineStore('unityProject', () => {
  const projectPath = ref('')
  const syncing = ref(false)
  const error = ref<unknown>(null)
  const filter = ref<UnityProjectFilter>('all')
  const states = ref<Record<string, UnityAssetProjectState>>({})
  const scanningDuplicates = ref(false)
  const duplicates = ref<Record<string, string[]>>({})

  const models = () => useAssetStore().assets.filter((asset) => asset.assetKind === 'model')

  async function synchronize(): Promise<void> {
    syncing.value = true
    error.value = null
    try {
      const result = await unityService.synchronize(models())
      projectPath.value = result.projectPath
      states.value = Object.fromEntries(result.states)
    } catch (cause) {
      error.value = cause
    } finally {
      syncing.value = false
    }
  }

  async function findDuplicates(): Promise<void> {
    scanningDuplicates.value = true
    try {
      duplicates.value = await modelFilesService.findDuplicates(models())
    } finally {
      scanningDuplicates.value = false
    }
  }

  return {
    projectPath,
    syncing,
    error,
    filter,
    states,
    scanningDuplicates,
    isSynchronized: computed(() => projectPath.value.length > 0),
    synchronize,
    findDuplicates,
    stateOf: (assetId: string): UnityAssetProjectState | null => states.value[assetId] ?? null,
    duplicatesOf: (assetId: string): string[] => duplicates.value[assetId] ?? [],
    setFilter: (value: UnityProjectFilter) => { filter.value = value },
  }
})
