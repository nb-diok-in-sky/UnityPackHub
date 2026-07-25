import type { ICommand } from '../../types/commands'
import { loadAssets, updateAssets } from './batchAssetUpdates'

export class BatchRemoveTagCommand implements ICommand {
  private affectedAssets: { id: string; hadTag: boolean }[] = []

  constructor(
    private readonly assetIds: string[],
    private readonly tagId: string,
    private readonly onComplete: () => Promise<void>,
  ) {}

  async execute(): Promise<void> {
    this.affectedAssets = []
    const assets = await loadAssets(this.assetIds)
    this.affectedAssets = assets.map(asset => ({ id: asset.id, hadTag: asset.tagIds.includes(this.tagId) }))
    await updateAssets(assets.filter(asset => asset.tagIds.includes(this.tagId)).map(asset => ({
      id: asset.id,
      data: {
            tagIds: asset.tagIds.filter((t) => t !== this.tagId),
            updatedAt: Date.now(),
      },
    })))
    await this.onComplete()
  }

  async undo(): Promise<void> {
    const ids = this.affectedAssets.filter(item => item.hadTag).map(item => item.id)
    const assets = await loadAssets(ids)
    await updateAssets(assets.filter(asset => !asset.tagIds.includes(this.tagId)).map(asset => ({
      id: asset.id,
      data: {
            tagIds: [...asset.tagIds, this.tagId],
            updatedAt: Date.now(),
      },
    })))
    await this.onComplete()
  }
}
