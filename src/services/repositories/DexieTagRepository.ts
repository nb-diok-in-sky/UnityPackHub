import type { Tag } from '../../types/asset'
import type { ITagRepository } from './ITagRepository'
import { db } from '../database'

export class DexieTagRepository implements ITagRepository {
  async getAll(): Promise<Tag[]> {
    return db.tags.orderBy('label').toArray()
  }

  async getById(id: string): Promise<Tag | undefined> {
    return db.tags.get(id)
  }

  async create(tag: Tag): Promise<string> {
    await db.tags.add(tag)
    return tag.id
  }

  async update(id: string, data: Partial<Tag>): Promise<void> {
    await db.tags.update(id, data)
  }

  async delete(id: string): Promise<void> {
    await db.tags.delete(id)
  }
}

export const tagRepository = new DexieTagRepository()
