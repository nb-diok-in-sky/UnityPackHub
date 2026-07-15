import type { UserSettings } from '../../types/asset'
import type { ISettingsRepository } from './ISettingsRepository'
import { DEFAULT_SETTINGS } from '../../types/asset'
import { readTextFile, writeTextFile, exists, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'

const SETTINGS_FILE = 'settings.json'

export class DexieSettingsRepository implements ISettingsRepository {
  private initialized = false

  private async ensureDir(): Promise<void> {
    if (this.initialized) return
    try {
      const dirExists = await exists('', { baseDir: BaseDirectory.AppData })
      if (!dirExists) {
        await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true })
      }
    } catch {
      await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true })
    }
    this.initialized = true
  }

  async get(): Promise<UserSettings> {
    try {
      await this.ensureDir()
      const fileExists = await exists(SETTINGS_FILE, { baseDir: BaseDirectory.AppData })
      if (!fileExists) {
        console.log('[Settings] no settings file yet, using defaults')
        return { ...DEFAULT_SETTINGS }
      }
      const text = await readTextFile(SETTINGS_FILE, { baseDir: BaseDirectory.AppData })
      const parsed = JSON.parse(text) as Partial<UserSettings>
      console.log('[Settings] loaded, scanDirs:', parsed.scanDirectories?.length ?? 0)
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        classification: {
          ...DEFAULT_SETTINGS.classification,
          ...parsed.classification,
        },
        shaderAdapters: {
          ...DEFAULT_SETTINGS.shaderAdapters,
          ...parsed.shaderAdapters,
        },
        id: 'user',
      }
    } catch (error) {
      console.error('[Settings] load FAILED:', error)
      return { ...DEFAULT_SETTINGS }
    }
  }

  async save(settings: UserSettings): Promise<void> {
    try {
      await this.ensureDir()
      const plain = JSON.parse(JSON.stringify(settings)) as UserSettings
      plain.id = 'user'
      const json = JSON.stringify(plain, null, 2)
      console.log('[Settings] saving, scanDirs:', plain.scanDirectories.length)
      await writeTextFile(SETTINGS_FILE, json, {
        baseDir: BaseDirectory.AppData,
      })
      console.log('[Settings] saved OK')
    } catch (error) {
      console.error('[Settings] save FAILED:', error)
      throw error
    }
  }
}

export const settingsRepository = new DexieSettingsRepository()
