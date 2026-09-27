import { computed, ref } from 'vue'
import type { Asset } from '../types/asset'
import type { AssetMetadata, RelatedFile } from '../platform/backend'
import { fileService } from '../services/fileService'
import { modelFilesService } from '../services/modelFilesService'

export type ModelFileFilter = 'all' | RelatedFile['fileType']

/** Detail section of a model: sibling files and its metadata row, loaded on first expand. */
export function useModelShowcase(asset: () => Asset) {
  const files = ref<RelatedFile[]>([])
  const metadata = ref<AssetMetadata | null>(null)
  const loading = ref(false)
  const loaded = ref(false)
  const open = ref(false)
  const filter = ref<ModelFileFilter>('all')

  const filtered = computed(() => (filter.value === 'all' ? files.value : files.value.filter((file) => file.fileType === filter.value)))
  const counts = computed(() => files.value.reduce<Record<string, number>>((result, file) => {
    result[file.fileType] = (result[file.fileType] ?? 0) + 1
    return result
  }, { all: files.value.length }))

  async function toggle(): Promise<void> {
    if (open.value) { open.value = false; return }
    open.value = true
    if (loaded.value) return
    loading.value = true
    try {
      const path = asset().filePath
      ;[files.value, metadata.value] = await Promise.all([modelFilesService.relatedFiles(path), modelFilesService.metadata(path)])
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  function reset(): void {
    files.value = []
    metadata.value = null
    loading.value = false
    loaded.value = false
    open.value = false
    filter.value = 'all'
  }

  return { files, metadata, loading, open, filter, filtered, counts, toggle, reset, reveal: (path: string) => fileService.reveal(path) }
}
