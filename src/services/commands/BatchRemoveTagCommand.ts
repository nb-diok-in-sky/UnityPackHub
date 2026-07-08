import type { ICommand } from '../../types/commands'
import { assetRepository } from '../repositories'

export class BatchRemoveTagCommand implements ICommand {
  private affectedAssets: { id: string; hadTag: boolean }[] = []

  constructor(
    private readonly assetIds: string[],
    private readonly tagId: string,
    private readonly onComplete: () => Promise<void>,
  ) {}

  async execute(): Promise<void> {
    this.affectedAssets = []
    for (const id of this.assetIds) {
      const asset = await assetRepository.getById(id)
      if (asset) {
        const hadTag = asset.tagIds.includes(this.tagId)
        this.affectedAssets.push({ id, hadTag })
        if (hadTag) {
          await assetRepository.update(id, {
            tagIds: asset.tagIds.filter((t) => t !== this.tagId),
            updatedAt: Date.now(),
          })
        }
      }
    }
    await this.onComplete()
  }

  async undo(): Promise<void> {
    for (const { id, hadTag } of this.affectedAssets) {
      if (hadTag) {
        const asset = await assetRepository.getById(id)
        if (asset && !asset.tagIds.includes(this.tagId)) {
          await assetRepository.update(id, {
            tagIds: [...asset.tagIds, this.tagId],
            updatedAt: Date.now(),
          })
        }
      }
    }
    await this.onComplete()
  }
}
