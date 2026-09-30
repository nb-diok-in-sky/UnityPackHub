// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Asset } from '../../src/types/asset'

const records = new Map<string, Asset>()
const groups = [{ id: 'g', name: 'Env', icon: 'folder', assetIds: ['a', 'b'], order: 1, createdAt: 0 }]

vi.mock('../../src/services/organizationService', () => ({
  assetRecords: {
    getAll: async () => [...records.values()],
    update: async (id: string, patch: Partial<Asset>) => {
      records.set(id, { ...records.get(id)!, ...patch })
    },
    updateMany: async (updates: Array<{ id: string; patch: Partial<Asset> }>) => {
      for (const { id, patch } of updates) records.set(id, { ...records.get(id)!, ...patch })
    },
  },
  groupRecords: { getAll: async () => groups, save: async () => {}, delete: async () => {} },
  tagRecords: { getAll: async () => [], save: async () => {}, delete: async () => [] },
}))
vi.mock('../../src/services/libraryService', () => ({
  libraryService: {
    remove: async (ids: string[]) => {
      const assets = ids.map((id) => records.get(id)!)
      ids.forEach((id) => records.delete(id))
      return { assets, memberships: ids.map((assetId) => ({ groupId: 'g', assetId })) }
    },
    restore: async (assets: Asset[]) => {
      assets.forEach((asset) => records.set(asset.id, asset))
    },
  },
}))
vi.mock('../../src/services/unityService', () => ({
  unityService: { importAsset: vi.fn(async () => ({ projectPath: 'D:\\Game', bridgeInstalled: false })) },
}))
vi.mock('../../src/services/coverService', () => ({
  coverService: { save: vi.fn(async () => {}), remove: vi.fn(async () => {}), load: async () => undefined },
}))

function asset(id: string, extra: Partial<Asset> = {}): Asset {
  return {
    id,
    name: id,
    fileName: `${id}.unitypackage`,
    filePath: `D:\\${id}.unitypackage`,
    fileSize: 1,
    assetKind: 'package',
    cover: 'none',
    notes: '',
    tagIds: [],
    isFavorite: false,
    createdAt: 0,
    updatedAt: 0,
    lastUsedAt: 0,
    ...extra,
  }
}

async function freshStore() {
  setActivePinia(createPinia())
  const { useAssetStore } = await import('../../src/stores/assetStore')
  const store = useAssetStore()
  await store.load()
  return store
}

describe('assetStore', () => {
  beforeEach(() => {
    records.clear()
    records.set('a', asset('a'))
    records.set('b', asset('b', { tagIds: ['t'] }))
  })

  it('undoes and redoes edits exactly', async () => {
    const store = await freshStore()
    await store.edit(['a', 'b'], (item) => (item.tagIds.includes('t') ? {} : { tagIds: [...item.tagIds, 't'] }))
    expect(records.get('a')?.tagIds).toEqual(['t'])
    expect(store.canUndo).toBe(true)

    await store.undo()
    expect(records.get('a')?.tagIds).toEqual([])
    expect(records.get('b')?.tagIds).toEqual(['t'])
    expect(store.canRedo).toBe(true)

    await store.redo()
    expect(store.byId.get('a')?.tagIds).toEqual(['t'])
  })

  it('does not record edits that change nothing', async () => {
    const store = await freshStore()
    await store.edit(['b'], () => ({ tagIds: ['t'] }))
    expect(store.canUndo).toBe(false)
  })

  it('removes and restores assets', async () => {
    const store = await freshStore()
    await store.remove(['a'])
    expect(store.assets.map((item) => item.id)).toEqual(['b'])
    await store.undo()
    expect(store.assets.map((item) => item.id).sort()).toEqual(['a', 'b'])
  })

  it('clears history after a scan', async () => {
    const store = await freshStore()
    await store.edit(['a'], () => ({ isFavorite: true }))
    store.clearHistory()
    expect(store.canUndo).toBe(false)
  })

  it('marks model covers as current and records usage on import', async () => {
    records.set('m', asset('m', { assetKind: 'model', modelPreview: { version: 0, error: 'boom', eligible: true } }))
    const store = await freshStore()
    await store.setCover(store.byId.get('m')!, new Blob())
    expect(records.get('m')).toMatchObject({ cover: 'stored', modelPreview: { error: '', version: 4 } })

    await store.importToUnity(store.byId.get('a')!)
    expect(records.get('a')!.lastUsedAt).toBeGreaterThan(0)
  })
})
