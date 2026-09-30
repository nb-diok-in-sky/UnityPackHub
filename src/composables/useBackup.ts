import { ref } from 'vue'
import { BACKUP_DATA_FILE } from '../domain/backup'
import { backupService } from '../services/backupService'
import { fileService, JSON_FILTER } from '../services/fileService'
import { useAssetStore } from '../stores/assetStore'
import { useBrowseStore } from '../stores/browseStore'
import { useCoverStore } from '../stores/coverStore'
import { useGroupStore } from '../stores/groupStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useTagStore } from '../stores/tagStore'
import { useI18n } from '../i18n'
import { confirm, errorMessage, notify } from '../ui/feedback'

/** Settings > Data: export the library to a folder and restore it from one. */
export function useBackup() {
  const { t, tr } = useI18n()
  const busy = ref(false)

  async function run(action: () => Promise<void>): Promise<void> {
    if (busy.value) return
    busy.value = true
    try { await action() } catch (error) { notify.error(tr('backupFailed', { reason: errorMessage(error) })) } finally { busy.value = false }
  }

  const exportBackup = () => run(async () => {
    const parent = await fileService.pickDirectory()
    if (!parent) return
    const summary = await backupService.export(parent, useSettingsStore().settings)
    notify.withAction(tr('backupExported', { assets: summary.assetCount, covers: summary.coverCount }), t.openFileLocation, () => {
      void fileService.reveal(summary.folder)
    })
  })

  const restoreBackup = () => run(async () => {
    const dataFile = await fileService.pickFile([{ ...JSON_FILTER, name: BACKUP_DATA_FILE }])
    if (!dataFile) return
    const backup = await backupService.inspect(dataFile)
    const exportedAt = new Date(backup.exportedAt).toLocaleString()
    if (!(await confirm(t.restoreBackup, tr('restoreBackupConfirm', { date: exportedAt, assets: backup.assets.length })))) return

    await backupService.restore(dataFile, backup)
    // Everything in memory describes the old library now.
    useCoverStore().clear()
    useBrowseStore().resetFilters()
    const assets = useAssetStore()
    assets.clearHistory()
    await useSettingsStore().load()
    await Promise.all([useTagStore().load(), useGroupStore().load(), assets.load()])
    notify.success(tr('backupRestored', { assets: backup.assets.length }))
  })

  return { busy, exportBackup, restoreBackup }
}
