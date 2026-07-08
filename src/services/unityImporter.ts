import { invoke } from '@tauri-apps/api/core'

export interface ImportResult {
  success: boolean
  message: string
  newlyInjected: boolean
}

export async function importToUnity(packagePath: string, projectPath?: string): Promise<ImportResult> {
  try {
    if (projectPath) {
      const injected = await invoke<boolean>('import_with_bridge', {
        packagePath,
        projectPath,
      })
      return { success: true, message: 'ok', newlyInjected: injected }
    }
    await invoke('open_with_default_app', { path: packagePath })
    return { success: true, message: 'ok', newlyInjected: false }
  } catch (error) {
    return { success: false, message: String(error), newlyInjected: false }
  }
}

export async function openFileLocation(filePath: string): Promise<void> {
  await invoke('reveal_in_explorer', { path: filePath })
}

export async function detectUnityProject(): Promise<string | null> {
  try {
    return await invoke<string | null>('detect_unity_project')
  } catch {
    return null
  }
}

export interface PreviewEntry {
  path: string
  name: string
  type: string
  preview: string
  renderType: 'rendered' | 'thumbnail'
}

export interface PackagePreviews {
  package_name: string
  entries: PreviewEntry[]
  preview_dir: string
}

export async function getPackagePreviews(packageName: string): Promise<PackagePreviews | null> {
  try {
    return await invoke<PackagePreviews | null>('get_package_previews', { packageName })
  } catch {
    return null
  }
}

export async function readPreviewImage(previewDir: string, filename: string): Promise<string | null> {
  try {
    return await invoke<string>('read_preview_image', { previewDir, filename })
  } catch {
    return null
  }
}
