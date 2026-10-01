import { onMounted, onUnmounted } from 'vue'
import { packageService } from '../services/packageService'
import { useAssetStore } from '../stores/assetStore'
import { useBrowseStore } from '../stores/browseStore'
import { useGroupStore } from '../stores/groupStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useTagStore } from '../stores/tagStore'
import { useUnityConnectionStore } from '../stores/unityConnectionStore'

function isTextInput(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  return !!element && (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName))
}

/**
 * Loads the library on start (from IndexedDB; scanning only happens on request) and binds the
 * global shortcuts. `closeDetail` returns true when it closed something, so Esc is layered:
 * tag painting, then selection, then the detail drawer.
 */
export function useAppShell(closeDetail: () => boolean) {
  const assets = useAssetStore()
  const browse = useBrowseStore()

  function handleKeydown(event: KeyboardEvent): void {
    // Text fields keep their own Ctrl+Z / Ctrl+A / Esc.
    if (isTextInput(event.target)) return
    const command = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (command && key === 'z') {
      event.preventDefault()
      void (event.shiftKey ? assets.redo() : assets.undo())
    } else if (command && key === 'y') {
      event.preventDefault()
      void assets.redo()
    } else if (command && key === 'a' && browse.visibleAssets.length > 0) {
      event.preventDefault()
      browse.selectAll()
    } else if (event.key === 'Escape') {
      if (browse.paintingTagId) browse.stopPainting()
      else if (browse.hasSelection) browse.clearSelection()
      else closeDetail()
    }
  }

  const unity = useUnityConnectionStore()

  onMounted(async () => {
    window.addEventListener('keydown', handleKeydown)
    unity.startMonitoring()
    await useSettingsStore().load()
    await Promise.all([useTagStore().load(), useGroupStore().load(), assets.load()])
    void packageService.pruneStaleListings().catch(() => undefined)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
    unity.stopMonitoring()
  })
}
