import type { Asset, UnityAssetLink, UnityLinkStatus, UnityProjectAsset } from '../types/asset'
import { unityAssetLinkRepository } from './repositories'
import { detectUnityProject, highlightUnityAssetPath, indexUnityProject } from './unityImporter'

export interface UnityAssetProjectState {
  link: UnityAssetLink | null
  projectAsset: UnityProjectAsset | null
  status: UnityLinkStatus
  duplicateCandidates: UnityProjectAsset[]
}

const normalize = (value: string) => value.replace(/\\/g, '/').toLocaleLowerCase()

function projectRelativePath(projectPath: string, sourcePath: string): string | null {
  const root = `${normalize(projectPath).replace(/\/$/, '')}/assets/`
  const source = normalize(sourcePath)
  return source.startsWith(root) ? `assets/${source.slice(root.length)}` : null
}

export class UnityProjectService {
  async synchronize(assets: Asset[]): Promise<{ projectPath: string; states: Map<string, UnityAssetProjectState> }> {
    const projectPath = await detectUnityProject()
    if (!projectPath) throw new Error('没有检测到已打开的 Unity 项目')

    const projectAssets = await indexUnityProject(projectPath)
    const previousLinks = await unityAssetLinkRepository.getByProject(projectPath)
    const previousByAssetId = new Map(previousLinks.map((link) => [link.assetId, link]))
    const byGuid = new Map(projectAssets.map((asset) => [asset.guid, asset]))
    const byPath = new Map(projectAssets.map((asset) => [normalize(asset.path), asset]))
    const byFileName = new Map<string, UnityProjectAsset[]>()
    for (const projectAsset of projectAssets) {
      const key = projectAsset.fileName.toLocaleLowerCase()
      byFileName.set(key, [...(byFileName.get(key) ?? []), projectAsset])
    }

    const links: UnityAssetLink[] = []
    const states = new Map<string, UnityAssetProjectState>()
    for (const asset of assets.filter((item) => item.assetKind === 'model')) {
      const previous = previousByAssetId.get(asset.id)
      const guidMatch = previous ? byGuid.get(previous.unityGuid) : undefined
      const relative = projectRelativePath(projectPath, asset.filePath)
      const pathMatch = relative ? byPath.get(normalize(relative)) : undefined
      const candidates = byFileName.get(asset.fileName.toLocaleLowerCase()) ?? []
      const matched = guidMatch ?? pathMatch ?? (candidates.length === 1 ? candidates[0] : undefined)
      const status: UnityLinkStatus = matched
        ? 'linked'
        : previous ? 'missing' : candidates.length > 1 ? 'ambiguous' : 'unlinked'
      const link: UnityAssetLink | null = matched ? {
        id: `${normalize(projectPath)}::${asset.id}`,
        assetId: asset.id,
        projectPath,
        unityGuid: matched.guid,
        unityPath: matched.path,
        matchMethod: guidMatch ? previous?.matchMethod ?? 'manual' : pathMatch ? 'path' : 'filename',
        status: 'linked',
        lastVerifiedAt: Date.now(),
      } : null
      if (link) links.push(link)
      states.set(asset.id, {
        link,
        projectAsset: matched ?? null,
        status,
        duplicateCandidates: candidates.length > 1 ? candidates : [],
      })
    }
    await unityAssetLinkRepository.replaceProject(projectPath, links)
    return { projectPath, states }
  }

  highlightProjectAsset(projectPath: string, unityPath: string) {
    return highlightUnityAssetPath(projectPath, unityPath)
  }
}

export const unityProjectService = new UnityProjectService()
