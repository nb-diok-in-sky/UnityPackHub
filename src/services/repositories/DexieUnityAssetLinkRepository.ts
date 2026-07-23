import type { UnityAssetLink } from '../../types/asset'
import type { IUnityAssetLinkRepository } from './IUnityAssetLinkRepository'
import { db } from '../database'

export class DexieUnityAssetLinkRepository implements IUnityAssetLinkRepository {
  getByProject(projectPath: string): Promise<UnityAssetLink[]> {
    return db.unityAssetLinks.where('projectPath').equals(projectPath).toArray()
  }

  async replaceProject(projectPath: string, links: UnityAssetLink[]): Promise<void> {
    await db.transaction('rw', db.unityAssetLinks, async () => {
      await db.unityAssetLinks.where('projectPath').equals(projectPath).delete()
      if (links.length > 0) await db.unityAssetLinks.bulkPut(links)
    })
  }
}

export const unityAssetLinkRepository = new DexieUnityAssetLinkRepository()
