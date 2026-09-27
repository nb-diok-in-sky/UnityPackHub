import { defineStore } from 'pinia'
import { ref } from 'vue'
import { libraryService, type ScanWarning } from '../services/libraryService'
import { classificationService } from '../services/classificationService'
import { useI18n } from '../i18n'
import { errorMessage, notify } from '../ui/feedback'
import { useAssetStore } from './assetStore'
import { useGroupStore } from './groupStore'
import { useSettingsStore } from './settingsStore'

/** Scan folders, scanning, and the optional model classification table. */
export const useLibraryStore = defineStore('library', () => {
  const isScanning = ref(false)
  const settings = useSettingsStore()
  const { tr } = useI18n()

  async function reload(): Promise<void> {
    await useAssetStore().load()
    await useGroupStore().load()
  }

  function describe(warning: ScanWarning): string {
    return warning.kind === 'unreachable'
      ? tr('scanUnreachable', { directories: warning.directories.join('、') })
      : tr('classificationFailed', { reason: warning.message })
  }

  /** Scans all enabled folders; problems are shown as notifications instead of thrown. */
  async function scan(): Promise<void> {
    if (isScanning.value) return
    isScanning.value = true
    try {
      const { classification } = settings.settings
      const { warnings } = await libraryService.scan(settings.settings.scanDirectories, classification.enabled ? classification.jsonPath : '')
      useAssetStore().clearHistory()
      await reload()
      for (const warning of warnings) notify.warning(describe(warning))
    } catch (error) {
      notify.error(tr('scanFailed', { reason: errorMessage(error) }))
    } finally {
      isScanning.value = false
    }
  }

  async function addDirectory(path: string): Promise<void> {
    if (settings.settings.scanDirectories.some((directory) => directory.path === path)) return
    await settings.update((draft) => { draft.scanDirectories.push({ path, enabled: true }) })
    await scan()
  }

  /** Forgets a folder and removes its assets (files on disk are untouched). */
  async function removeDirectory(path: string): Promise<void> {
    await settings.update((draft) => { draft.scanDirectories = draft.scanDirectories.filter((directory) => directory.path !== path) })
    const remaining = settings.settings.scanDirectories.filter((directory) => directory.enabled).map((directory) => directory.path)
    await libraryService.removeDirectory(path, remaining)
    useAssetStore().clearHistory()
    await reload()
  }

  async function toggleDirectory(path: string): Promise<void> {
    let enabled = false
    await settings.update((draft) => {
      const directory = draft.scanDirectories.find((current) => current.path === path)
      if (directory) enabled = directory.enabled = !directory.enabled
    })
    if (enabled) await scan()
  }

  async function setClassificationTable(jsonPath: string): Promise<void> {
    await settings.update((draft) => { draft.classification = { jsonPath, enabled: jsonPath.length > 0 } })
    if (jsonPath) await scan()
    else {
      await classificationService.clear()
      await useGroupStore().load()
    }
  }

  return { isScanning, scan, addDirectory, removeDirectory, toggleDirectory, setClassificationTable }
})
