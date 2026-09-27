import { computed, ref } from 'vue'
import { addTag, removeTag, setFavorite } from '../domain/assetChanges'
import { useAssetStore } from '../stores/assetStore'
import { useBrowseStore } from '../stores/browseStore'

/** Actions of the multi-selection toolbar. All of them are undoable. */
export function useBatchAssetActions() {
  const assets = useAssetStore()
  const browse = useBrowseStore()
  const deleteDialogOpen = ref(false)
  const selected = () => [...browse.selectedIds]

  return {
    browse,
    selectedCount: computed(() => browse.selectedIds.size),
    canUndo: computed(() => assets.canUndo),
    deleteDialogOpen,
    addTag: async (tagId: string) => { await assets.edit(selected(), addTag(tagId)); browse.clearSelection() },
    removeTag: (tagId: string) => assets.edit(selected(), removeTag(tagId)),
    favorite: async () => { await assets.edit(selected(), setFavorite(true)); browse.clearSelection() },
    unfavorite: async () => { await assets.edit(selected(), setFavorite(false)); browse.clearSelection() },
    deleteSelected: async () => {
      await assets.remove(selected())
      browse.clearSelection()
      deleteDialogOpen.value = false
    },
    undo: () => assets.undo(),
  }
}
