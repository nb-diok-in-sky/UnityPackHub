import { computed, ref } from 'vue'
import { addTag, removeTag, setFavorite } from '../domain/assetChanges'
import { useAssetStore } from '../stores/assetStore'
import { useBrowseStore } from '../stores/browseStore'
import { useAssetActions } from './useAssetActions'

/** Actions of the multi-selection toolbar. All of them are undoable. */
export function useBatchAssetActions() {
  const assets = useAssetStore()
  const browse = useBrowseStore()
  const deleteDialogOpen = ref(false)
  const actions = useAssetActions()
  const selected = () => [...browse.selectedIds]

  return {
    browse,
    selectedCount: computed(() => browse.selectedIds.size),
    canUndo: computed(() => assets.canUndo),
    deleteDialogOpen,
    addTag: async (tagId: string) => {
      await assets.edit(selected(), addTag(tagId))
      browse.clearSelection()
    },
    removeTag: (tagId: string) => assets.edit(selected(), removeTag(tagId)),
    favorite: async () => {
      await assets.edit(selected(), setFavorite(true))
      browse.clearSelection()
    },
    unfavorite: async () => {
      await assets.edit(selected(), setFavorite(false))
      browse.clearSelection()
    },
    deleteSelected: async () => {
      deleteDialogOpen.value = false
      await actions.removeFromLibrary(selected())
    },
    /** Shown while a manual group is selected: takes the selection out of it. */
    activeGroupName: computed(() => browse.activeManualGroup?.name ?? null),
    removeFromGroup: async () => {
      await actions.removeFromActiveGroup(selected())
      browse.clearSelection()
    },
    undo: () => assets.undo(),
  }
}
