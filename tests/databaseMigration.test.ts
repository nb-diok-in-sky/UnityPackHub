// Opens a database written by UnityPackHub 0.4 (schema version 7) with the current schema and
// checks that the version 8 upgrade keeps every user-visible piece of data.
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'

const V7_ASSETS =
  'id, name, fileName, filePath, fileSize, isFavorite, assetKind, createdAt, updatedAt, lastUsedAt, *tagIds'

async function seedVersion7(): Promise<void> {
  const legacy = new Dexie('UnityPackHub')
  legacy.version(7).stores({
    assets: V7_ASSETS,
    tags: 'id, label',
    settings: 'id',
    groups: 'id, name, order',
    showcaseCache: 'filePath',
    thumbnails: 'id',
    unityAssetLinks: 'id, assetId, projectPath, unityGuid, unityPath, status',
    assetStoreLinks: 'assetId, packageId, productName',
  })
  await legacy.open()
  const base = {
    notes: 'keep',
    tagIds: ['t'],
    isFavorite: true,
    createdAt: 1,
    updatedAt: 1,
    lastUsedAt: 0,
    fileSize: 10,
  }
  await legacy.table('assets').bulkPut([
    {
      ...base,
      id: 'blob',
      name: 'Blob',
      fileName: 'Blob.unitypackage',
      filePath: 'D:\\Blob.unitypackage',
      assetKind: 'package',
      thumbnailPath: 'db',
    },
    {
      ...base,
      id: 'inline',
      name: 'Inline',
      fileName: 'Inline.unitypackage',
      filePath: 'D:\\Inline.unitypackage',
      assetKind: 'package',
      thumbnailPath: 'data:image/png;base64,AQID',
    },
    {
      ...base,
      id: 'model',
      name: 'Oak',
      fileName: 'Oak.fbx',
      filePath: 'D:\\Oak.fbx',
      assetKind: 'model',
      thumbnailPath: '',
      modelPreviewVersion: 3,
      modelPreviewError: 'boom',
      modelPreviewEligible: false,
    },
  ])
  await legacy.table('thumbnails').put({ id: 'blob', blob: new Blob([new Uint8Array([9])], { type: 'image/png' }) })
  await legacy.table('tags').put({ id: 't', label: 'Forest', color: '#000' })
  legacy.close()
}

describe('database version 8 upgrade', () => {
  it('migrates covers and model fields without losing user data', async () => {
    await seedVersion7()
    const { db } = await import('../src/data/database')
    await db.open()

    const assets = Object.fromEntries((await db.assets.toArray()).map((asset) => [asset.id, asset]))
    expect(assets.blob).toMatchObject({ cover: 'stored', notes: 'keep', tagIds: ['t'], isFavorite: true })
    expect(assets.inline?.cover).toBe('stored')
    expect(assets.model).toMatchObject({ cover: 'none', modelPreview: { version: 3, error: 'boom', eligible: false } })
    expect(Object.values(assets).some((asset) => 'thumbnailPath' in asset)).toBe(false)

    const inlineCover = await db.thumbnails.get('inline')
    expect([...new Uint8Array(await inlineCover!.blob.arrayBuffer())]).toEqual([1, 2, 3])
    expect(await db.thumbnails.get('blob')).toBeDefined()
    expect(await db.tags.count()).toBe(1)
    expect(await db.assets.where('tagIds').equals('t').count()).toBe(3)
  })
})
