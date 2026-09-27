export type AppLocale = 'zh-CN' | 'en-US'
export type AppTheme = 'light' | 'dark' | 'system'
export type CardSize = 'sm' | 'md' | 'lg'
export type SortKey = 'name' | 'createdAt' | 'fileSize' | 'lastUsedAt'
export type SortOrder = 'asc' | 'desc'

export interface ScanDirectory {
  path: string
  enabled: boolean
}

export interface QuickLink {
  name: string
  url: string
  icon?: string
}

export interface ClassificationSettings {
  enabled: boolean
  jsonPath: string
}

export interface ShaderAdapterSettings {
  rulesPath: string
}

export interface UserSettings {
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
  defaultPipelineTagsInitialized: boolean
}
