import type { ICommand } from '../../types/commands'
import { assetRepository } from '../repositories'

export class BatchFavoriteCommand implements ICommand {
  private previousStates: { id: string; wasFavorite: boolean }[] = []

  constructor(
    private readonly assetIds: string[],
    private readonly setFavorite: boolean,
    private readonly onComplete: () => Promise<void>,
  ) {}

  async execute(): Promise<void> {
    this.previousStates = []
    for (const id of this.assetIds) {
      const asset = await assetRepository.getById(id)
      if (asset) {
        this.previousStates.push({ id, wasFavorite: asset.isFavorite })
        await assetRepository.update(id, {
          isFavorite: this.setFavorite,
          updatedAt: Date.now(),
        })
      }
    }
    await this.onComplete()
  }

  async undo(): Promise<void> {
    for (const { id, wasFavorite } of this.previousStates) {
      await assetRepository.update(id, {
        isFavorite: wasFavorite,
        updatedAt: Date.now(),
      })
    }
    await this.onComplete()
  }
}
