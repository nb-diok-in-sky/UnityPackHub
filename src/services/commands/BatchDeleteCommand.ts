import type { ICommand } from '../../types/commands'
import type { Asset } from '../../types/asset'
import { assetRepository } from '../repositories'

export class BatchDeleteCommand implements ICommand {
  private deletedAssets: Asset[] = []

  constructor(
    private readonly assetIds: string[],
    private readonly onComplete: () => Promise<void>,
  ) {}

  async execute(): Promise<void> {
    this.deletedAssets = []
    for (const id of this.assetIds) {
      const asset = await assetRepository.getById(id)
      if (asset) {
        this.deletedAssets.push(asset)
      }
    }
    await assetRepository.bulkDelete(this.assetIds)
    await this.onComplete()
  }

  async undo(): Promise<void> {
    if (this.deletedAssets.length > 0) {
      await assetRepository.bulkCreate(this.deletedAssets)
    }
    await this.onComplete()
  }
}
