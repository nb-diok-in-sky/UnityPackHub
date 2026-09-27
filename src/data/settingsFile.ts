// User settings live in %APPDATA%/com.unitypackhub.app/settings.json (not IndexedDB), so the
// Unity bridge and the user can read them and they survive WebView storage resets.
import type { UserSettings } from '../types/settings'
import { defaultSettings, normalizeSettings } from '../domain/settings'
import { appData } from '../platform/system'

const SETTINGS_FILE = 'settings.json'

export const settingsFile = {
  async load(): Promise<UserSettings> {
    try {
      const text = await appData.read(SETTINGS_FILE)
      return text ? normalizeSettings(JSON.parse(text)) : defaultSettings()
    } catch (error) {
      console.error('[Settings] load failed, using defaults:', error)
      return defaultSettings()
    }
  },
  async save(settings: UserSettings): Promise<void> {
    await appData.write(SETTINGS_FILE, JSON.stringify(settings, null, 2))
  },
}
