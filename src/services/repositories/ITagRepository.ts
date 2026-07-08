import type { Tag } from '../../types/asset'

export interface ITagRepository {
  getAll(): Promise<Tag[]>
  getById(id: string): Promise<Tag | undefined>
  create(tag: Tag): Promise<string>
  update(id: string, data: Partial<Tag>): Promise<void>
  delete(id: string): Promise<void>
}
