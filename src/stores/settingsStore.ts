import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppLocale, AppTheme, CardSize, QuickLink, SortKey, SortOrder, UserSettings } from '../types/settings'
import { defaultSettings } from '../domain/settings'
import { settingsService } from '../services/settingsService'
import { useI18n } from '../i18n'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<UserSettings>(defaultSettings())
  const { setLocale } = useI18n()
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

  function applyTheme(): void {
    const theme = settings.value.theme
    document.documentElement.classList.toggle(
      'dark-theme',
      theme === 'dark' || (theme === 'system' && systemDark.matches),
    )
  }
  systemDark.addEventListener('change', applyTheme)

  async function load(): Promise<void> {
    settings.value = await settingsService.load()
    setLocale(settings.value.locale)
    applyTheme()
  }

  /** Applies a change and persists the whole settings file. */
  async function update(change: (draft: UserSettings) => void): Promise<void> {
    change(settings.value)
    await settingsService.save(settings.value)
  }

  return {
    settings,
    load,
    update,
    setCardSize: (size: CardSize) =>
      update((draft) => {
        draft.cardSize = size
      }),
    setSortBy: (key: SortKey) =>
      update((draft) => {
        draft.sortBy = key
      }),
    setSortOrder: (order: SortOrder) =>
      update((draft) => {
        draft.sortOrder = order
      }),
    setUnityEditorPath: (path: string) =>
      update((draft) => {
        draft.unityEditorPath = path
      }),
    setShaderAdapterRulesPath: (path: string) =>
      update((draft) => {
        draft.shaderAdapters.rulesPath = path
      }),
    addQuickLink: (link: QuickLink) =>
      update((draft) => {
        draft.quickLinks.push(link)
      }),
    removeQuickLink: (url: string) =>
      update((draft) => {
        draft.quickLinks = draft.quickLinks.filter((link) => link.url !== url)
      }),
    async setAppLocale(locale: AppLocale): Promise<void> {
      await update((draft) => {
        draft.locale = locale
      })
      setLocale(locale)
    },
    async setTheme(theme: AppTheme): Promise<void> {
      await update((draft) => {
        draft.theme = theme
      })
      applyTheme()
    },
  }
})
