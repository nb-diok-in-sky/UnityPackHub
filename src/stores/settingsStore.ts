import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserSettings, ScanDirectory, CardSize, SortKey, SortOrder, AppLocale, AppTheme, QuickLink } from '../types/asset'
import { DEFAULT_SETTINGS } from '../types/asset'
import { settingsRepository } from '../services/repositories'
import { useI18n } from '../services/i18n'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<UserSettings>({ ...DEFAULT_SETTINGS })
  const isLoaded = ref(false)

  const { setLocale } = useI18n()

  function applyTheme(theme: AppTheme): void {
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark-theme', isDark)
  }

  async function load(): Promise<void> {
    settings.value = await settingsRepository.get()
    setLocale(settings.value.locale)
    applyTheme(settings.value.theme)
    isLoaded.value = true
  }

  async function save(): Promise<void> {
    settings.value.id = 'user'
    await settingsRepository.save(settings.value)
  }

  async function addScanDirectory(path: string): Promise<void> {
    const exists = settings.value.scanDirectories.some((d) => d.path === path)
    if (exists) return

    settings.value.scanDirectories.push({ path, enabled: true })
    await save()
  }

  async function removeScanDirectory(path: string): Promise<void> {
    settings.value.scanDirectories = settings.value.scanDirectories.filter(
      (d) => d.path !== path
    )
    await save()
  }

  async function toggleScanDirectory(path: string): Promise<void> {
    const dir = settings.value.scanDirectories.find((d) => d.path === path)
    if (dir) {
      dir.enabled = !dir.enabled
      await save()
    }
  }

  async function setCardSize(size: CardSize): Promise<void> {
    settings.value.cardSize = size
    await save()
  }

  async function setSortBy(key: SortKey): Promise<void> {
    settings.value.sortBy = key
    await save()
  }

  async function setSortOrder(order: SortOrder): Promise<void> {
    settings.value.sortOrder = order
    await save()
  }

  async function setAppLocale(locale: AppLocale): Promise<void> {
    settings.value.locale = locale
    setLocale(locale)
    await save()
  }

  async function setTheme(theme: AppTheme): Promise<void> {
    settings.value.theme = theme
    applyTheme(theme)
    await save()
  }

  async function addQuickLink(link: QuickLink): Promise<void> {
    settings.value.quickLinks.push(link)
    await save()
  }

  async function removeQuickLink(url: string): Promise<void> {
    settings.value.quickLinks = settings.value.quickLinks.filter(l => l.url !== url)
    await save()
  }

  return {
    settings,
    isLoaded,
    load,
    save,
    addScanDirectory,
    removeScanDirectory,
    toggleScanDirectory,
    setCardSize,
    setSortBy,
    setSortOrder,
    setAppLocale,
    setTheme,
    addQuickLink,
    removeQuickLink,
  }
})
