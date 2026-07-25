import type { ThumbnailRecord } from '../database'

export interface IThumbnailRepository {
  get(id: string): Promise<ThumbnailRecord | undefined>
  save(id: string, blob: Blob): Promise<void>
  delete(id: string): Promise<void>
  deleteMany(ids: string[]): Promise<void>
}
