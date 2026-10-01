// IndexedDB access. The only module besides database.ts that touches Dexie tables.
import type { Asset, AssetGroup, Tag, UnityAssetLink } from '../types/asset'
import { db, type AssetStoreLinkRecord } from './database'

export const assetRepository = {
  getAll: (): Promise<Asset[]> => db.assets.toArray(),
  getMany: async (ids: string[]): Promise<Asset[]> =>
    (await db.assets.bulkGet(ids)).filter((asset): asset is Asset => !!asset),
  put: async (assets: Asset[]): Promise<void> => {
    await db.assets.bulkPut(assets)
  },
  update: async (id: string, patch: Partial<Asset>): Promise<void> => {
    await db.assets.update(id, patch)
  },
  updateMany: (updates: Array<{ id: string; patch: Partial<Asset> }>): Promise<void> =>
    db.transaction('rw', db.assets, async () => {
      await Promise.all(updates.map(({ id, patch }) => db.assets.update(id, patch)))
    }),
  delete: async (ids: string[]): Promise<void> => {
    await db.assets.bulkDelete(ids)
  },
  withTag: (tagId: string): Promise<Asset[]> => db.assets.where('tagIds').equals(tagId).toArray(),
}

export const coverRepository = {
  get: async (id: string): Promise<Blob | undefined> => (await db.thumbnails.get(id))?.blob,
  save: async (id: string, blob: Blob): Promise<void> => {
    await db.thumbnails.put({ id, blob })
  },
  delete: async (ids: string[]): Promise<void> => {
    await db.thumbnails.bulkDelete(ids)
  },
  /** Removes covers whose asset no longer exists. */
  deleteOrphans: async (assetIds: ReadonlySet<string>): Promise<void> => {
    const keys = (await db.thumbnails.toCollection().primaryKeys()) as string[]
    const orphans = keys.filter((key) => !assetIds.has(key))
    if (orphans.length > 0) await db.thumbnails.bulkDelete(orphans)
  },
}

export const tagRepository = {
  getAll: (): Promise<Tag[]> => db.tags.orderBy('label').toArray(),
  put: async (tag: Tag): Promise<void> => {
    await db.tags.put(tag)
  },
  delete: async (id: string): Promise<void> => {
    await db.tags.delete(id)
  },
}

export const groupRepository = {
  getAll: (): Promise<AssetGroup[]> => db.groups.orderBy('order').toArray(),
  put: async (group: AssetGroup): Promise<void> => {
    await db.groups.put(group)
  },
  update: async (id: string, patch: Partial<AssetGroup>): Promise<void> => {
    await db.groups.update(id, patch)
  },
  delete: async (ids: string[]): Promise<void> => {
    await db.groups.bulkDelete(ids)
  },
  /** Drops asset ids from every group that contains them. */
  removeMembers: async (assetIds: ReadonlySet<string>): Promise<void> => {
    const groups = await db.groups.toArray()
    await Promise.all(
      groups
        .filter((group) => group.assetIds.some((id) => assetIds.has(id)))
        .map((group) => db.groups.update(group.id, { assetIds: group.assetIds.filter((id) => !assetIds.has(id)) })),
    )
  },
}

export const unityLinkRepository = {
  getByProject: (projectPath: string): Promise<UnityAssetLink[]> =>
    db.unityAssetLinks.where('projectPath').equals(projectPath).toArray(),
  replaceProject: (projectPath: string, links: UnityAssetLink[]): Promise<void> =>
    db.transaction('rw', db.unityAssetLinks, async () => {
      await db.unityAssetLinks.where('projectPath').equals(projectPath).delete()
      if (links.length > 0) await db.unityAssetLinks.bulkPut(links)
    }),
}

export const assetStoreLinkRepository = {
  get: (assetId: string): Promise<AssetStoreLinkRecord | undefined> => db.assetStoreLinks.get(assetId),
  save: async (link: AssetStoreLinkRecord): Promise<void> => {
    await db.assetStoreLinks.put(link)
  },
  delete: async (ids: string[]): Promise<void> => {
    await db.assetStoreLinks.bulkDelete(ids)
  },
}

/** Parsed package listings, keyed by path and invalidated when the file size changes. */
export const showcaseCacheRepository = {
  async get<T>(key: string, fileSize: number): Promise<T | null> {
    const cached = await db.showcaseCache.get(key)
    return cached && cached.fileSize === fileSize ? (JSON.parse(cached.data) as T) : null
  },
  async put(key: string, fileSize: number, value: unknown): Promise<void> {
    await db.showcaseCache.put({ filePath: key, fileSize, parsedAt: Date.now(), data: JSON.stringify(value) })
  },
  async deleteByPrefix(prefix: string): Promise<void> {
    const keys = (await db.showcaseCache.toCollection().primaryKeys()) as string[]
    await db.showcaseCache.bulkDelete(keys.filter((key) => key.startsWith(prefix)))
  },
  /** Deletes every entry whose key does not end with `suffix`; returns how many were removed. */
  async deleteUnlessSuffix(suffix: string): Promise<number> {
    const keys = (await db.showcaseCache.toCollection().primaryKeys()) as string[]
    const stale = keys.filter((key) => !key.endsWith(suffix))
    await db.showcaseCache.bulkDelete(stale)
    return stale.length
  },
}

/** Everything in IndexedDB except caches, for backups. */
export interface LibrarySnapshot {
  assets: Asset[]
  tags: Tag[]
  groups: AssetGroup[]
  unityAssetLinks: UnityAssetLink[]
  assetStoreLinks: AssetStoreLinkRecord[]
}

export const librarySnapshot = {
  async read(): Promise<LibrarySnapshot> {
    const [assets, tags, groups, unityAssetLinks, assetStoreLinks] = await Promise.all([
      db.assets.toArray(),
      db.tags.toArray(),
      db.groups.toArray(),
      db.unityAssetLinks.toArray(),
      db.assetStoreLinks.toArray(),
    ])
    return { assets, tags, groups, unityAssetLinks, assetStoreLinks }
  },

  /** Calls `visit` for every stored cover, one at a time to keep memory flat. */
  async eachCover(visit: (id: string, image: Blob) => Promise<void>): Promise<void> {
    const ids = (await db.thumbnails.toCollection().primaryKeys()) as string[]
    for (const id of ids) {
      const record = await db.thumbnails.get(id)
      if (record) await visit(id, record.blob)
    }
  },

  /** Replaces the whole library in one transaction; the showcase cache is dropped too. */
  async replace(snapshot: LibrarySnapshot, covers: Array<{ id: string; blob: Blob }>): Promise<void> {
    await db.transaction(
      'rw',
      [db.assets, db.tags, db.groups, db.unityAssetLinks, db.assetStoreLinks, db.thumbnails, db.showcaseCache],
      async () => {
        await Promise.all([
          db.assets.clear(),
          db.tags.clear(),
          db.groups.clear(),
          db.unityAssetLinks.clear(),
          db.assetStoreLinks.clear(),
          db.thumbnails.clear(),
          db.showcaseCache.clear(),
        ])
        await db.assets.bulkPut(snapshot.assets)
        await db.tags.bulkPut(snapshot.tags)
        await db.groups.bulkPut(snapshot.groups)
        await db.unityAssetLinks.bulkPut(snapshot.unityAssetLinks)
        await db.assetStoreLinks.bulkPut(snapshot.assetStoreLinks)
        await db.thumbnails.bulkPut(covers)
      },
    )
  },
}
