import type { ICommand } from '../../types/commands'
import { loadAssets, updateAssets } from './batchAssetUpdates'

export class BatchFavoriteCommand implements ICommand {
  private previousStates: { id: string; wasFavorite: boolean }[] = []

  constructor(
    private readonly assetIds: string[],
    private readonly setFavorite: boolean,
    private readonly onComplete: () => Promise<void>,
  ) {}

  async execute(): Promise<void> {
    this.previousStates = []
    const assets = await loadAssets(this.assetIds)
    this.previousStates = assets.map(asset => ({ id: asset.id, wasFavorite: asset.isFavorite }))
    await updateAssets(assets.map(asset => ({
      id: asset.id,
      data: {
          isFavorite: this.setFavorite,
          updatedAt: Date.now(),
      },
    })))
    await this.onComplete()
  }

  async undo(): Promise<void> {
    await updateAssets(this.previousStates.map(({ id, wasFavorite }) => ({
      id,
      data: {
        isFavorite: wasFavorite,
        updatedAt: Date.now(),
      },
    })))
    await this.onComplete()
  }
}
