import type { Asset } from '../../types/asset'
import type { ISortStrategy } from '../../types/strategies'

export class DateSortStrategy implements ISortStrategy {
  readonly key = 'createdAt'
  readonly label = '添加时间'

  compare(a: Asset, b: Asset, order: 'asc' | 'desc'): number {
    const modifier = order === 'asc' ? 1 : -1
    return modifier * (a.createdAt - b.createdAt)
  }

  sort(assets: Asset[], order: 'asc' | 'desc'): Asset[] {
    return [...assets].sort((a, b) => this.compare(a, b, order))
  }
}
