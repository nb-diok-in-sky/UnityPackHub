import type { Asset, UnityAssetLink, UnityAssetProjectState, UnityLinkStatus, UnityProjectAsset } from '../types/asset'

const normalize = (value: string) => value.replace(/\\/g, '/').toLocaleLowerCase()

/** `assets/...` path of a file that lives inside the project, or null. */
function projectRelativePath(projectPath: string, sourcePath: string): string | null {
  const root = `${normalize(projectPath).replace(/\/$/, '')}/assets/`
  const source = normalize(sourcePath)
  return source.startsWith(root) ? `assets/${source.slice(root.length)}` : null
}

/**
 * Matches library models to assets of the open Unity project: by the GUID remembered from
 * the last sync, then by path inside the project, then by a unique file name.
 */
export function linkModelsToProject(
  projectPath: string,
  models: readonly Asset[],
  projectAssets: readonly UnityProjectAsset[],
  previousLinks: readonly UnityAssetLink[],
  now = Date.now(),
): { links: UnityAssetLink[]; states: Map<string, UnityAssetProjectState> } {
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
  for (const asset of models) {
    const previous = previousByAssetId.get(asset.id)
    const guidMatch = previous ? byGuid.get(previous.unityGuid) : undefined
    const relative = projectRelativePath(projectPath, asset.filePath)
    const pathMatch = relative ? byPath.get(relative) : undefined
    const candidates = byFileName.get(asset.fileName.toLocaleLowerCase()) ?? []
    const matched = guidMatch ?? pathMatch ?? (candidates.length === 1 ? candidates[0] : undefined)
    const status: UnityLinkStatus = matched
      ? 'linked'
      : previous
        ? 'missing'
        : candidates.length > 1
          ? 'ambiguous'
          : 'unlinked'
    const link: UnityAssetLink | null = matched
      ? {
          id: `${normalize(projectPath)}::${asset.id}`,
          assetId: asset.id,
          projectPath,
          unityGuid: matched.guid,
          unityPath: matched.path,
          matchMethod: guidMatch ? (previous?.matchMethod ?? 'manual') : pathMatch ? 'path' : 'filename',
          status: 'linked',
          lastVerifiedAt: now,
        }
      : null
    if (link) links.push(link)
    states.set(asset.id, {
      link,
      projectAsset: matched ?? null,
      status,
      duplicateCandidates: candidates.length > 1 ? candidates : [],
    })
  }
  return { links, states }
}
