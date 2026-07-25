import type { ICommand } from '../../types/commands'
import { loadAssets, updateAssets } from './batchAssetUpdates'

export class BatchTagCommand implements ICommand {
  private affectedAssetIds: string[] = []

  constructor(
    private readonly assetIds: string[],
    private readonly tagId: string,
    private readonly onComplete: () => Promise<void>,
  ) {}

  async execute(): Promise<void> {
    const assets = await loadAssets(this.assetIds)
    const affectedAssets = assets.filter(asset => !asset.tagIds.includes(this.tagId))
    this.affectedAssetIds = affectedAssets.map(asset => asset.id)
    await updateAssets(affectedAssets.map(asset => ({
      id: asset.id,
      data: {
          tagIds: [...asset.tagIds, this.tagId],
          updatedAt: Date.now(),
      },
    })))
    await this.onComplete()
  }

  async undo(): Promise<void> {
    const assets = await loadAssets(this.affectedAssetIds)
    await updateAssets(assets.map(asset => ({
      id: asset.id,
      data: {
          tagIds: asset.tagIds.filter((t) => t !== this.tagId),
          updatedAt: Date.now(),
      },
    })))
    await this.onComplete()
  }
}
