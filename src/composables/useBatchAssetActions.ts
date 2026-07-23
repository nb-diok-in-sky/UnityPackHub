import { computed, ref } from 'vue'
import { useAssetStore } from '../stores/assetStore'
import { commandManager } from '../services/commandManager'
import { BatchDeleteCommand } from '../services/commands/BatchDeleteCommand'
import { BatchFavoriteCommand } from '../services/commands/BatchFavoriteCommand'
import { BatchRemoveTagCommand } from '../services/commands/BatchRemoveTagCommand'
import { BatchTagCommand } from '../services/commands/BatchTagCommand'

export function useBatchAssetActions() {
  const assetStore = useAssetStore()
  const deleteDialogOpen = ref(false)
  const selectedCount = computed(() => assetStore.selectedIds.size)
  const canUndo = computed(() => commandManager.canUndo)

  const selectedIds = () => [...assetStore.selectedIds]
  const reloadAssets = () => assetStore.load()

  async function addTag(tagId: string): Promise<void> {
    await commandManager.execute(new BatchTagCommand(selectedIds(), tagId, reloadAssets))
    assetStore.clearSelection()
  }

  async function removeTag(tagId: string): Promise<void> {
    await commandManager.execute(new BatchRemoveTagCommand(selectedIds(), tagId, reloadAssets))
  }

  async function setFavorite(isFavorite: boolean): Promise<void> {
    await commandManager.execute(new BatchFavoriteCommand(selectedIds(), isFavorite, reloadAssets))
    assetStore.clearSelection()
  }

  async function deleteSelected(): Promise<void> {
    await commandManager.execute(new BatchDeleteCommand(selectedIds(), reloadAssets))
    assetStore.clearSelection()
    deleteDialogOpen.value = false
  }

  return {
    assetStore,
    selectedCount,
    canUndo,
    deleteDialogOpen,
    addTag,
    removeTag,
    favorite: () => setFavorite(true),
    unfavorite: () => setFavorite(false),
    deleteSelected,
    undo: () => commandManager.undo(),
  }
}
