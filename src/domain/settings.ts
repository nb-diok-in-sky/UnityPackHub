import type { CardSize, UserSettings } from '../types/settings'

export const CARD_SIZE_MAP: Record<CardSize, number> = {
  sm: 160,
  md: 220,
  lg: 300,
}

export function defaultSettings(): UserSettings {
  return {
    scanDirectories: [],
    unityEditorPath: '',
    cardSize: 'md',
    sortBy: 'name',
    sortOrder: 'asc',
    locale: 'zh-CN',
    theme: 'light',
    quickLinks: [
      { name: 'Unity Asset Store', url: 'https://assetstore.unity.com', icon: 'storefront' },
      { name: 'Fab (Quixel)', url: 'https://www.fab.com', icon: 'public' },
      { name: 'Sketchfab', url: 'https://sketchfab.com', icon: 'view_in_ar' },
      { name: 'Itch.io', url: 'https://itch.io/game-assets', icon: 'sports_esports' },
      { name: 'OpenGameArt', url: 'https://opengameart.org', icon: 'palette' },
      { name: 'Kenney', url: 'https://kenney.nl', icon: 'extension' },
    ],
    classification: { enabled: false, jsonPath: '' },
    shaderAdapters: { rulesPath: '' },
    defaultPipelineTagsInitialized: false,
  }
}

/** Fills fields missing from an older or hand-edited settings.json with defaults. */
export function normalizeSettings(raw: unknown): UserSettings {
  const defaults = defaultSettings()
  if (!raw || typeof raw !== 'object') return defaults
  const parsed = raw as Partial<UserSettings>
  return {
    ...defaults,
    ...parsed,
    scanDirectories: Array.isArray(parsed.scanDirectories) ? parsed.scanDirectories : defaults.scanDirectories,
    quickLinks: Array.isArray(parsed.quickLinks) ? parsed.quickLinks : defaults.quickLinks,
    classification: { ...defaults.classification, ...parsed.classification },
    shaderAdapters: { ...defaults.shaderAdapters, ...parsed.shaderAdapters },
  }
}
