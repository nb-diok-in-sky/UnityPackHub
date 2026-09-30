// Typed wrappers for every Rust command (src-tauri/src/lib.rs). The only file that calls `invoke`.
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export interface ScannedFile {
  name: string
  fileName: string
  filePath: string
  fileSize: number
  assetKind: 'package' | 'model'
}

export interface ScanResult {
  files: ScannedFile[]
  /** Only these directories were readable; assets elsewhere must not be treated as deleted. */
  scannedDirectories: string[]
}

export interface ScanProgress {
  /** Files and folders looked at so far. */
  visited: number
  /** Packages and models found so far. */
  found: number
}

export interface RelatedFile {
  fileName: string
  filePath: string
  fileSize: number
  fileType: 'texture' | 'material' | 'prefab' | 'model'
}

export interface AssetMetadata {
  originalName: string
  inferredObject: string | null
  format: string | null
  boundsText: string | null
  path: string
  sourceAsset: string | null
  confidence: string | null
}

export interface FileHashResult {
  filePath: string
  hash: string
  error: string
}

export interface PackageAssetEntry {
  guid: string
  pathname: string
  filename: string
  extension: string
  assetType: string
  /** Preview image embedded in the package, extracted to the app cache (see `appFileUrl`). */
  previewPath: string | null
  hasAssetData: boolean
}

export interface PackageAssetList {
  entries: PackageAssetEntry[]
  totalCount: number
}

export interface PreviewFolder {
  path: string
  /** Package pathname -> preview PNG name. */
  outputFiles: Record<string, string>
  /** Names of the preview PNGs that already exist in `path`. */
  files: string[]
}

export interface RenderedPreview {
  path: string
  name: string
  type: string
  preview: string
  renderType: 'rendered' | 'thumbnail'
}

export interface RenderedPreviews {
  /** Folder holding the PNGs named in `entries[].preview`. */
  path: string
  entries: RenderedPreview[]
}

export interface ProjectAsset {
  guid: string
  path: string
  fileName: string
  assetType: string
  dependencies: string[]
  sceneUsageCount: number
  referencedBy: string[]
}

export interface EditorActionResult {
  success: boolean
  message: string
  assetPath: string
  assets: ProjectAsset[]
}

export type BridgeStatus = 'ready' | 'outdated' | 'offline'

export interface ModelPreviewRequest {
  assetId: string
  sourcePath: string
}
export interface ModelPreviewResult {
  assetId: string
  imagePath: string
  success: boolean
  error: string
}

/** Progress events sent by `scan_directories` while it walks the folders. */
export function onScanProgress(handler: (progress: ScanProgress) => void): Promise<() => void> {
  return listen<ScanProgress>('library://scan-progress', (event) => handler(event.payload))
}

// Changes Unity writes to disk, pushed by the backend's file watcher (src-tauri/src/events.rs).
export const onPackagePreviewsChanged = (handler: (packageKey: string) => void) =>
  listen<{ packageKey: string }>('unity://package-previews-changed', (event) => handler(event.payload.packageKey))
export const onModelPreviewResults = (handler: () => void) => listen('unity://model-preview-results', handler)
export const onModelPreviewFinished = (handler: () => void) => listen('unity://model-preview-finished', handler)
export const onEditorActionResult = (handler: (id: string) => void) =>
  listen<{ id: string }>('unity://editor-action-result', (event) => handler(event.payload.id))

/** URL an `<img>` can load a file from the app data folder with (served by the `uph` scheme). */
export function appFileUrl(path: string): string {
  return convertFileSrc(path, 'uph')
}

export const backend = {
  // library
  scanDirectories: (dirs: string[]) => invoke<ScanResult>('scan_directories', { dirs }),
  scanModelRelatedFiles: (modelPath: string) => invoke<RelatedFile[]>('scan_model_related_files', { modelPath }),
  readAssetMetadata: (jsonPath: string, assetPath: string) =>
    invoke<AssetMetadata | null>('read_asset_metadata', { jsonPath, assetPath }),
  readAssetMetadataTable: (jsonPath: string) => invoke<AssetMetadata[]>('read_asset_metadata_table', { jsonPath }),
  hashFiles: (paths: string[]) => invoke<FileHashResult[]>('hash_files', { paths }),

  // packages
  parsePackageAssets: (path: string) => invoke<PackageAssetList>('parse_package_assets', { path }),

  // system
  openWithDefaultApp: (path: string) => invoke<void>('open_with_default_app', { path }),
  revealInExplorer: (path: string) => invoke<void>('reveal_in_explorer', { path }),

  // open Unity editor
  detectUnityProject: () => invoke<string | null>('detect_unity_project'),
  discoverUnityEditors: () => invoke<string[]>('discover_unity_editors'),
  installUnityBridge: (projectPath: string) => invoke<boolean>('install_unity_bridge', { projectPath }),
  unityBridgeStatus: (projectPath: string) => invoke<BridgeStatus>('unity_bridge_status', { projectPath }),
  requestUnityEditorAction: (projectPath: string, action: string, sourcePath: string) =>
    invoke<string>('request_unity_editor_action', { projectPath, action, sourcePath }),
  collectUnityEditorActionResult: (id: string) =>
    invoke<EditorActionResult | null>('collect_unity_editor_action_result', { id }),
  importPackageIntoUnity: (packagePath: string, projectPath: string, packageKey: string) =>
    invoke<boolean>('import_package_into_unity', { packagePath, projectPath, packageKey }),

  // package previews rendered by the bridge
  requestPackagePreviews: (packageKey: string, prefabs: Array<{ pathname: string; filename: string }>) =>
    invoke<PreviewFolder>('request_package_previews', { packageKey, prefabs }),
  listPackagePreviewFiles: (packageKey: string) => invoke<string[]>('list_package_preview_files', { packageKey }),
  getRenderedPreviews: (packageKey: string) => invoke<RenderedPreviews | null>('get_rendered_previews', { packageKey }),
  clearAllPreviews: () => invoke<number>('clear_all_previews'),

  // model covers rendered by the headless preview project
  startModelPreviewJob: (unityEditorPath: string, models: ModelPreviewRequest[], shaderRulesPath: string) =>
    invoke<number>('start_model_preview_job', { unityEditorPath, models, shaderRulesPath }),
  isModelPreviewJobRunning: () => invoke<boolean>('is_model_preview_job_running'),
  cancelModelPreviewJob: () => invoke<boolean>('cancel_model_preview_job'),
  collectModelPreviewResults: () => invoke<ModelPreviewResult[]>('collect_model_preview_results'),
}
