import type { Asset } from './asset'

export interface ISortStrategy {
  readonly key: string
  readonly label: string
  sort(assets: Asset[], order: 'asc' | 'desc'): Asset[]
  compare(a: Asset, b: Asset, order: 'asc' | 'desc'): number
}
