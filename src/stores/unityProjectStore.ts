import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Asset, UnityProjectFilter } from '../types/asset'
import { unityProjectService, type UnityAssetProjectState } from '../services/unityProjectService'

export const useUnityProjectStore = defineStore('unityProject', () => {
  const projectPath = ref('')
  const syncing = ref(false)
  const error = ref('')
  const filter = ref<UnityProjectFilter>('all')
  const states = ref<Record<string, UnityAssetProjectState>>({})

  const isSynchronized = computed(() => projectPath.value.length > 0)

  async function synchronize(assets: Asset[]): Promise<void> {
    syncing.value = true
    error.value = ''
    try {
      const result = await unityProjectService.synchronize(assets)
      projectPath.value = result.projectPath
      states.value = Object.fromEntries(result.states)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      throw cause
    } finally {
      syncing.value = false
    }
  }

  function getState(assetId: string): UnityAssetProjectState | null {
    return states.value[assetId] ?? null
  }

  function setFilter(value: UnityProjectFilter): void { filter.value = value }

  return { projectPath, syncing, error, filter, states, isSynchronized, synchronize, getState, setFilter }
})
