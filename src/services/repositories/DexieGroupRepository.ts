import type { AssetGroup } from '../../types/asset'
import type { IGroupRepository } from './IGroupRepository'
import { db } from '../database'

export class DexieGroupRepository implements IGroupRepository {
  async getAll(): Promise<AssetGroup[]> {
    return db.groups.orderBy('order').toArray()
  }

  async getById(id: string): Promise<AssetGroup | undefined> {
    return db.groups.get(id)
  }

  async create(group: AssetGroup): Promise<string> {
    await db.groups.add(group)
    return group.id
  }

  async update(id: string, data: Partial<AssetGroup>): Promise<void> {
    await db.groups.update(id, data)
  }

  async delete(id: string): Promise<void> {
    await db.groups.delete(id)
  }
}

export const groupRepository = new DexieGroupRepository()
