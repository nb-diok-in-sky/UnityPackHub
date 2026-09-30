import type { Asset } from '../types/asset'
import { addTag, removeTag } from '../domain/assetChanges'
import { useAssetStore } from '../stores/assetStore'
import { useBrowseStore } from '../stores/browseStore'
import { useGroupStore } from '../stores/groupStore'
import { useI18n } from '../i18n'
import { errorMessage, notify } from '../ui/feedback'

/** Asset actions shared by the card, its context menu and the selection toolbar, with feedback. */
export function useAssetActions() {
  const assets = useAssetStore()
  const browse = useBrowseStore()
  const groups = useGroupStore()
  const { t, tr } = useI18n()

  async function importToUnity(asset: Asset): Promise<void> {
    try {
      const result = await assets.importToUnity(asset)
      if (result.projectPath) notify.success(tr('importSentToProject', { project: result.projectPath.split(/[\\/]/).filter(Boolean).pop() ?? '' }))
      else notify.info(t.importOpenedWithDefaultApp)
    } catch (error) {
      notify.error(tr('importFailed', { reason: errorMessage(error) }))
    }
  }

  /** Removes from the library (files stay on disk) and offers an undo right in the toast. */
  async function removeFromLibrary(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await assets.remove(ids)
    browse.clearSelection()
    notify.withAction(tr('removedFromLibrary', { count: ids.length }), t.undo, () => { void assets.undo() })
  }

  async function removeFromActiveGroup(ids: string[]): Promise<void> {
    const group = browse.activeManualGroup
    if (!group) return
    await groups.removeAssets(group.id, ids)
    notify.withAction(tr('removedFromGroup', { count: ids.length, group: group.name }), t.undo, () => { void groups.addAssets(group.id, ids) })
  }

  async function toggleTag(asset: Asset, tagId: string): Promise<void> {
    await assets.edit([asset.id], asset.tagIds.includes(tagId) ? removeTag(tagId) : addTag(tagId))
  }

  return { importToUnity, removeFromLibrary, removeFromActiveGroup, toggleTag }
}
