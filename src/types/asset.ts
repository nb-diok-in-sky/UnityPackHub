export type AssetKind = 'package' | 'model'
export type ModelCoverStatus = 'pending' | 'completed' | 'failed' | 'not-needed'
export type ModelCoverFilter = 'all' | ModelCoverStatus

export interface Asset {
  id: string
  name: string
  fileName: string
  filePath: string
  fileSize: number
  thumbnailPath: string
  modelPreviewVersion?: number
  modelPreviewError?: string
  modelPreviewEligible?: boolean
  notes: string
  tagIds: string[]
  isFavorite: boolean
  assetKind: AssetKind
  createdAt: number
  updatedAt: number
  lastUsedAt: number
}

export interface Tag {
  id: string
  label: string
  color: string
  isSystem?: boolean
}

export type UnityLinkStatus = 'linked' | 'missing' | 'ambiguous' | 'unlinked'
export type UnityProjectFilter = 'all' | UnityLinkStatus | 'in-scene' | 'duplicate'

export interface UnityAssetLink {
  id: string
  assetId: string
  projectPath: string
  unityGuid: string
  unityPath: string
  matchMethod: 'path' | 'filename' | 'manual'
  status: Exclude<UnityLinkStatus, 'unlinked'>
  lastVerifiedAt: number
}

export interface UnityProjectAsset {
  guid: string
  path: string
  fileName: string
  assetType: string
  dependencies: string[]
  sceneUsageCount: number
  referencedBy: string[]
}

export interface UnityAssetInspectionIssue {
  id: string
  severity: 'info' | 'warning' | 'error'
  message: string
}

export interface AssetGroup {
  id: string
  name: string
  icon: string
  assetIds: string[]
  order: number
  createdAt: number
  source?: 'manual' | 'classification'
  sourceKey?: string
  assetKind?: AssetKind
}

export interface ClassificationSettings {
  enabled: boolean
  jsonPath: string
}

export interface ShaderAdapterSettings {
  rulesPath: string
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
  classification: ClassificationSettings
  shaderAdapters: ShaderAdapterSettings
  defaultPipelineTagsInitialized?: boolean
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
  classification: {
    enabled: false,
    jsonPath: '',
  },
  shaderAdapters: {
    rulesPath: '',
  },
  defaultPipelineTagsInitialized: false,
}
