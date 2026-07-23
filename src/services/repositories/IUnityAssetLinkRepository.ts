import type { UnityAssetLink } from '../../types/asset'

export interface IUnityAssetLinkRepository {
  getByProject(projectPath: string): Promise<UnityAssetLink[]>
  replaceProject(projectPath: string, links: UnityAssetLink[]): Promise<void>
}
