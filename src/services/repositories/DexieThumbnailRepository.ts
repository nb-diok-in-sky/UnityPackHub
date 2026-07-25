import type { ThumbnailRecord } from '../database'
import { db } from '../database'
import type { IThumbnailRepository } from './IThumbnailRepository'

export class DexieThumbnailRepository implements IThumbnailRepository {
  get(id: string): Promise<ThumbnailRecord | undefined> { return db.thumbnails.get(id) }
  async save(id: string, blob: Blob): Promise<void> { await db.thumbnails.put({ id, blob }) }
  async delete(id: string): Promise<void> { await db.thumbnails.delete(id) }
  async deleteMany(ids: string[]): Promise<void> { await db.thumbnails.bulkDelete(ids) }
}

export const thumbnailRepository = new DexieThumbnailRepository()
