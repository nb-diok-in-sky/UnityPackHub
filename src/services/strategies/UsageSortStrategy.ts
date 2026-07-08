import type { Asset } from '../../types/asset'
import type { ISortStrategy } from '../../types/strategies'

export class UsageSortStrategy implements ISortStrategy {
  readonly key = 'lastUsedAt'
  readonly label = '最近使用'

  compare(a: Asset, b: Asset, order: 'asc' | 'desc'): number {
    const modifier = order === 'asc' ? 1 : -1
    return modifier * (a.lastUsedAt - b.lastUsedAt)
  }

  sort(assets: Asset[], order: 'asc' | 'desc'): Asset[] {
    return [...assets].sort((a, b) => this.compare(a, b, order))
  }
}
