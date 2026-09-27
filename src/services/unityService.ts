// The Unity Editor the user has open: importing packages, locating assets, indexing the project.
import type { Asset, UnityAssetProjectState } from '../types/asset'
import { linkModelsToProject } from '../domain/unityLinking'
import { packagePreviewKey } from '../domain/paths'
import { backend, type EditorActionResult } from '../platform/backend'
import { unityLinkRepository } from '../data/repositories'

export type UnityActionError = 'no-project' | 'bridge-offline' | 'bridge-outdated' | 'timeout'

export class UnityError extends Error {
  constructor(readonly reason: UnityActionError | 'unity', message: string = reason) {
    super(message)
  }
}

export interface ImportResult {
  /** Project the package was imported into, or null when it was only opened with the OS. */
  projectPath: string | null
  /** The bridge scripts were (re)installed, so Unity compiles before rendering previews. */
  bridgeInstalled: boolean
}

async function detectProject(): Promise<string | null> {
  try { return await backend.detectUnityProject() } catch { return null }
}

async function requireProject(): Promise<string> {
  const projectPath = await detectProject()
  if (!projectPath) throw new UnityError('no-project')
  return projectPath
}

async function runEditorAction(projectPath: string, action: string, sourcePath = '', timeoutMs = 12_000): Promise<EditorActionResult> {
  const status = await backend.unityBridgeStatus(projectPath)
  if (status !== 'ready') {
    // Installing makes Unity pick the bridge up on its next compile; the user retries afterwards.
    await backend.installUnityBridge(projectPath)
    throw new UnityError(status === 'outdated' ? 'bridge-outdated' : 'bridge-offline')
  }
  const id = await backend.requestUnityEditorAction(projectPath, action, sourcePath)
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const result = await backend.collectUnityEditorActionResult(id)
    if (!result) continue
    if (!result.success) throw new UnityError('unity', result.message)
    return result
  }
  throw new UnityError('timeout')
}

export const unityService = {
  detectProject,

  /**
   * Packages go to the open project through the bridge (so previews are rendered after the
   * import); without an open project, and for model files, the OS default app opens the file.
   */
  async importAsset(asset: Asset): Promise<ImportResult> {
    const projectPath = asset.assetKind === 'package' ? await detectProject() : null
    if (!projectPath) {
      await backend.openWithDefaultApp(asset.filePath)
      return { projectPath: null, bridgeInstalled: false }
    }
    const bridgeInstalled = await backend.importPackageIntoUnity(asset.filePath, projectPath, packagePreviewKey(asset.filePath))
    return { projectPath, bridgeInstalled }
  },

  /** Selects the asset in Unity's Project window; returns its path inside the project. */
  async highlightFile(sourcePath: string): Promise<string> {
    return (await runEditorAction(await requireProject(), 'highlight', sourcePath)).assetPath
  },

  async highlightProjectPath(projectPath: string, unityPath: string): Promise<void> {
    await runEditorAction(projectPath, 'highlight-path', unityPath)
  },

  /** Indexes the open project and links library models to its assets. */
  async synchronize(models: Asset[]): Promise<{ projectPath: string; states: Map<string, UnityAssetProjectState> }> {
    const projectPath = await requireProject()
    const { assets } = await runEditorAction(projectPath, 'index', '', 30_000)
    const previous = await unityLinkRepository.getByProject(projectPath)
    const { links, states } = linkModelsToProject(projectPath, models, assets, previous)
    await unityLinkRepository.replaceProject(projectPath, links)
    return { projectPath, states }
  },

  discoverEditors: (): Promise<string[]> => backend.discoverUnityEditors(),
}
