import { invoke } from '@tauri-apps/api/core'

interface ScannedFile {
  name: string
  fileName: string
  filePath: string
  fileSize: number
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

export const commands = {
  scanDirectories: (dirs: string[]) =>
    invoke<ScannedFile[]>('scan_directories', { dirs }),

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

  ensurePreviewDir: (packageName: string, prefabNames: string[]) =>
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
}

export type {
  ScannedFile,
  PreviewDirInfo,
  PackagePreviews,
  PreviewEntry,
  PackageAssetEntry,
  PackageAssetList,
  PackageInfo,
}
