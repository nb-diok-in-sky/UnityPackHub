import type { ICommand } from '../../types/commands'
import { assetRepository } from '../repositories'

export class BatchTagCommand implements ICommand {
  constructor(
    private readonly assetIds: string[],
    private readonly tagId: string,
    private readonly onComplete: () => Promise<void>,
  ) {}

  async execute(): Promise<void> {
    for (const id of this.assetIds) {
      const asset = await assetRepository.getById(id)
      if (asset && !asset.tagIds.includes(this.tagId)) {
        await assetRepository.update(id, {
          tagIds: [...asset.tagIds, this.tagId],
          updatedAt: Date.now(),
        })
      }
    }
    await this.onComplete()
  }

  async undo(): Promise<void> {
    for (const id of this.assetIds) {
      const asset = await assetRepository.getById(id)
      if (asset) {
        await assetRepository.update(id, {
          tagIds: asset.tagIds.filter((t) => t !== this.tagId),
          updatedAt: Date.now(),
        })
      }
    }
    await this.onComplete()
  }
}
