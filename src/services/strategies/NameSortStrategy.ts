import type { Asset } from '../../types/asset'
import type { ISortStrategy } from '../../types/strategies'

export class NameSortStrategy implements ISortStrategy {
  readonly key = 'name'
  readonly label = '名称'

  compare(a: Asset, b: Asset, order: 'asc' | 'desc'): number {
    const modifier = order === 'asc' ? 1 : -1
    return modifier * a.name.localeCompare(b.name, 'zh-CN')
  }

  sort(assets: Asset[], order: 'asc' | 'desc'): Asset[] {
    return [...assets].sort((a, b) => this.compare(a, b, order))
  }
}
