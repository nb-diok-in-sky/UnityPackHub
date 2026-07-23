import { invoke } from '@tauri-apps/api/core'
import type { PackagePreviewRequest } from './packagePreviewFile'

interface ScannedFile {
  name: string
  fileName: string
  filePath: string
  fileSize: number
  assetKind: 'package' | 'model'
}

interface RelatedFile {
  fileName: string
  filePath: string
  fileSize: number
  fileType: string
}

interface AssetMetadata {
  originalName: string
  inferredObject: string | null
  format: string | null
  boundsText: string | null
  path: string
  sourceAsset: string | null
  confidence: string | null
}

interface PreviewDirInfo {
  path: string
  existing_files: string[]
}

interface PackagePreviews {
  package_name: string
  entries: PreviewEntry[]
  preview_dir: string
}

interface PreviewEntry {
  path: string
  name: string
  type: string
  preview: string
  renderType: 'rendered' | 'thumbnail'
}

interface PackageAssetEntry {
  guid: string
  pathname: string
  filename: string
  extension: string
  asset_type: string
  preview: string | null
  has_asset_data: boolean
}

interface PackageAssetList {
  entries: PackageAssetEntry[]
  total_count: number
}

interface PackageInfo {
  files: string[]
  preview: string | null
  file_count: number
}

interface ModelPreviewRequest { assetId: string; sourcePath: string }
interface ModelPreviewResult { assetId: string; imagePath: string; success: boolean; error: string }
interface FileHashResult { filePath: string; hash: string; error: string }

export const commands = {
  scanDirectories: (dirs: string[]) =>
    invoke<ScannedFile[]>('scan_directories', { dirs }),

  scanModelRelatedFiles: (modelPath: string) =>
    invoke<RelatedFile[]>('scan_model_related_files', { modelPath }),

  readAssetMetadata: (jsonPath: string, assetPath: string) =>
    invoke<AssetMetadata | null>('read_asset_metadata', { jsonPath, assetPath }),

  readAssetMetadataTable: (jsonPath: string) =>
    invoke<AssetMetadata[]>('read_asset_metadata_table', { jsonPath }),

  parseUnityPackage: (path: string) =>
    invoke<PackageInfo>('parse_unity_package', { path }),

  extractPackagePreview: (path: string) =>
    invoke<string | null>('extract_package_preview', { path }),

  parsePackageAssets: (path: string) =>
    invoke<PackageAssetList>('parse_package_assets', { path }),

  extractSingleAsset: (packagePath: string, guid: string, targetDir: string) =>
    invoke<string[]>('extract_single_asset', {
      request: { package_path: packagePath, guid, target_dir: targetDir },
    }),

  openWithDefaultApp: (path: string) =>
    invoke<void>('open_with_default_app', { path }),

  revealInExplorer: (path: string) =>
    invoke<void>('reveal_in_explorer', { path }),

  debugPackagePathnames: (path: string) =>
    invoke<Record<string, string>>('debug_package_pathnames', { path }),

  ensurePreviewDir: (packageName: string, prefabNames: PackagePreviewRequest[]) =>
    invoke<PreviewDirInfo>('ensure_preview_dir', { packageName, prefabNames }),

  clearAllPreviews: () =>
    invoke<number>('clear_all_previews'),

  detectUnityProject: () =>
    invoke<string | null>('detect_unity_project'),

  ensureBridgeScript: (projectPath: string) =>
    invoke<boolean>('ensure_bridge_script', { projectPath }),

  getPackagePreviews: (packageName: string) =>
    invoke<PackagePreviews | null>('get_package_previews', { packageName }),

  readPreviewImage: (previewDir: string, filename: string) =>
    invoke<string>('read_preview_image', { previewDir, filename }),

  readAllPreviews: (previewDir: string) =>
    invoke<Record<string, string>>('read_all_previews', { previewDir }),

  importWithBridge: (packagePath: string, projectPath: string) =>
    invoke<boolean>('import_with_bridge', { packagePath, projectPath }),

  discoverUnityEditors: () => invoke<string[]>('discover_unity_editors'),
  startModelPreviewJob: (unityEditorPath: string, models: ModelPreviewRequest[], shaderRulesPath = '') =>
    invoke<number>('start_model_preview_job', { unityEditorPath, models, shaderRulesPath }),
  requestUnityEditorAction: (projectPath: string, action: string, sourcePath: string) =>
    invoke<string>('request_unity_editor_action', { projectPath, action, sourcePath }),
  collectUnityEditorActionResult: (id: string) =>
    invoke<string | null>('collect_unity_editor_action_result', { id }),
  isUnityEditorBridgeReady: () => invoke<boolean>('is_unity_editor_bridge_ready'),
  collectModelPreviewResults: () =>
    invoke<ModelPreviewResult[]>('collect_model_preview_results'),
  cancelModelPreviewJob: () => invoke<boolean>('cancel_model_preview_job'),
  readModelPreviewImage: (path: string) =>
    invoke<string>('read_model_preview_image', { path }),
  hashFiles: (paths: string[]) => invoke<FileHashResult[]>('hash_files', { paths }),
}

export type {
  ScannedFile,
  PreviewDirInfo,
  PackagePreviews,
  PreviewEntry,
  PackageAssetEntry,
  PackageAssetList,
  PackageInfo,
  RelatedFile,
  AssetMetadata,
  ModelPreviewRequest,
  ModelPreviewResult,
  FileHashResult,
}
