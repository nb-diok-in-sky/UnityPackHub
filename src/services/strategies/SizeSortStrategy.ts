import type { Asset } from '../../types/asset'
import type { ISortStrategy } from '../../types/strategies'

export class SizeSortStrategy implements ISortStrategy {
  readonly key = 'fileSize'
  readonly label = '文件大小'

  compare(a: Asset, b: Asset, order: 'asc' | 'desc'): number {
    const modifier = order === 'asc' ? 1 : -1
    return modifier * (a.fileSize - b.fileSize)
  }

  sort(assets: Asset[], order: 'asc' | 'desc'): Asset[] {
    return [...assets].sort((a, b) => this.compare(a, b, order))
  }
}
