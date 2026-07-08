export interface Asset {
  id: string
  name: string
  fileName: string
  filePath: string
  fileSize: number
  thumbnailPath: string
  notes: string
  tagIds: string[]
  isFavorite: boolean
  createdAt: number
  updatedAt: number
  lastUsedAt: number
}

export interface Tag {
  id: string
  label: string
  color: string
}

export interface AssetGroup {
  id: string
  name: string
  icon: string
  assetIds: string[]
  order: number
  createdAt: number
}

export interface ScanDirectory {
  path: string
  enabled: boolean
}

export type AppLocale = 'zh-CN' | 'en-US'
export type AppTheme = 'light' | 'dark' | 'system'

export interface QuickLink {
  name: string
  url: string
  icon?: string
}

export interface UserSettings {
  id: string
  scanDirectories: ScanDirectory[]
  unityEditorPath: string
  cardSize: CardSize
  sortBy: SortKey
  sortOrder: SortOrder
  locale: AppLocale
  theme: AppTheme
  quickLinks: QuickLink[]
}

export type CardSize = 'sm' | 'md' | 'lg'
export type SortKey = 'name' | 'createdAt' | 'fileSize' | 'lastUsedAt'
export type SortOrder = 'asc' | 'desc'

export const CARD_SIZE_MAP: Record<CardSize, number> = {
  sm: 160,
  md: 220,
  lg: 300,
}

export const DEFAULT_SETTINGS: UserSettings = {
  id: 'user',
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
}
