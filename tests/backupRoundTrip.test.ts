// Export → wipe → restore against an in-memory file system: the library must come back intact.
import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'

const files = new Map<string, Uint8Array | string>()

vi.mock('../src/platform/system', () => ({
  createDirectory: async () => {},
  writeBinaryFileAt: async (path: string, content: Uint8Array) => {
    files.set(path, content)
  },
  writeTextFileAt: async (path: string, content: string) => {
    files.set(path, content)
  },
  readTextFileAt: async (path: string) => {
    const content = files.get(path)
    if (typeof content !== 'string') throw new Error(`missing ${path}`)
    return content
  },
  readBinaryFile: async (path: string) => {
    const content = files.get(path)
    if (!(content instanceof Uint8Array)) throw new Error(`missing ${path}`)
    return content
  },
  appData: {
    read: async (name: string) => (files.get(`appdata/${name}`) as string | undefined) ?? null,
    write: async (name: string, content: string) => {
      files.set(`appdata/${name}`, content)
    },
  },
}))

describe('backup round trip', () => {
  it('restores assets, tags, groups, covers and settings', async () => {
    const { db } = await import('../src/data/database')
    const { backupService } = await import('../src/services/backupService')
    const { defaultSettings } = await import('../src/domain/settings')

    const asset = {
      id: 'a1',
      name: 'Trees',
      fileName: 'Trees.unitypackage',
      filePath: 'D:\\Packs\\Trees.unitypackage',
      fileSize: 1,
      assetKind: 'package' as const,
      cover: 'stored' as const,
      notes: 'my note',
      tagIds: ['t1'],
      isFavorite: true,
      createdAt: 1,
      updatedAt: 1,
      lastUsedAt: 0,
    }
    await db.assets.put(asset)
    await db.tags.put({ id: 't1', label: 'Forest', color: '#000' })
    await db.groups.put({ id: 'g1', name: 'Env', icon: 'folder', assetIds: ['a1'], order: 1, createdAt: 1 })
    await db.thumbnails.put({ id: 'a1', blob: new Blob([new Uint8Array([7, 8, 9])], { type: 'image/png' }) })
    const settings = { ...defaultSettings(), scanDirectories: [{ path: 'D:\\Packs', enabled: true }] }

    const summary = await backupService.export('D:\\Backups', settings, new Date(2026, 8, 30, 12, 0))
    expect(summary).toMatchObject({ assetCount: 1, coverCount: 1 })

    await Promise.all([db.assets.clear(), db.tags.clear(), db.groups.clear(), db.thumbnails.clear()])
    const dataFile = `${summary.folder}\\data.json`
    await backupService.restore(dataFile, await backupService.inspect(dataFile))

    expect(await db.assets.get('a1')).toMatchObject({
      notes: 'my note',
      tagIds: ['t1'],
      isFavorite: true,
      cover: 'stored',
    })
    expect(await db.tags.count()).toBe(1)
    expect((await db.groups.get('g1'))?.assetIds).toEqual(['a1'])
    const cover = await db.thumbnails.get('a1')
    expect([...new Uint8Array(await cover!.blob.arrayBuffer())]).toEqual([7, 8, 9])
    expect(JSON.parse(files.get('appdata/settings.json') as string).scanDirectories).toEqual(settings.scanDirectories)
  })
})
