import type { ICommand } from '../../types/commands'
import type { Asset } from '../../types/asset'
import { assetRepository } from '../repositories'
import { loadAssets } from './batchAssetUpdates'

export class BatchDeleteCommand implements ICommand {
  private deletedAssets: Asset[] = []

  constructor(
    private readonly assetIds: string[],
    private readonly onComplete: () => Promise<void>,
  ) {}

  async execute(): Promise<void> {
    this.deletedAssets = await loadAssets(this.assetIds)
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
