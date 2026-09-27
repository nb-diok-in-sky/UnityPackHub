export type AssetKind = 'package' | 'model'
export type ModelCoverStatus = 'pending' | 'completed' | 'failed' | 'not-needed'
export type ModelCoverFilter = 'all' | ModelCoverStatus

/** Whether a cover image is stored in the `covers` table under the asset id. */
export type CoverState = 'none' | 'stored'

/** Render state of a model's automatic cover. Only present on model assets. */
export interface ModelPreviewState {
  /** Renderer version that produced the current cover; 0 = never rendered. */
  version: number
  error: string
  /** False for files that are not worth rendering (animation clips, meshless files). */
  eligible: boolean
}

export interface Asset {
  id: string
  name: string
  fileName: string
  filePath: string
  fileSize: number
  assetKind: AssetKind
  cover: CoverState
  modelPreview?: ModelPreviewState
  /** Its scan folder could not be read in the last scan; hidden until the folder is back. */
  offline?: boolean
  notes: string
  tagIds: string[]
  isFavorite: boolean
  createdAt: number
  updatedAt: number
  lastUsedAt: number
}

/** Fields the user edits directly; changes to them are undoable. */
export type AssetEdit = Partial<Pick<Asset, 'notes' | 'tagIds' | 'isFavorite'>>

export interface Tag {
  id: string
  label: string
  color: string
  isSystem?: boolean
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

export interface UnityAssetProjectState {
  link: UnityAssetLink | null
  projectAsset: UnityProjectAsset | null
  status: UnityLinkStatus
  duplicateCandidates: UnityProjectAsset[]
}

export interface AssetStoreProduct {
  packageId: string
  name: string
  productUrl: string
  imageUrl: string
}
