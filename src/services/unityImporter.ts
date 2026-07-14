import { commands } from './tauriCommands'

export interface ImportResult {
  success: boolean
  message: string
  newlyInjected: boolean
}

export async function importToUnity(packagePath: string, projectPath?: string): Promise<ImportResult> {
  try {
    if (projectPath) {
      const injected = await commands.importWithBridge(packagePath, projectPath)
      return { success: true, message: 'ok', newlyInjected: injected }
    }
    await commands.openWithDefaultApp(packagePath)
    return { success: true, message: 'ok', newlyInjected: false }
  } catch (error) {
    return { success: false, message: String(error), newlyInjected: false }
  }
}

export async function openFileLocation(filePath: string): Promise<void> {
  await commands.revealInExplorer(filePath)
}

export async function detectUnityProject(): Promise<string | null> {
  try {
    return await commands.detectUnityProject()
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
    return await commands.getPackagePreviews(packageName)
  } catch {
    return null
  }
}

export async function readPreviewImage(previewDir: string, filename: string): Promise<string | null> {
  try {
    return await commands.readPreviewImage(previewDir, filename)
  } catch {
    return null
  }
}
