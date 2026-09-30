// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Asset, AssetGroup } from '../../src/types/asset'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  withAction: vi.fn(),
}))
const records = new Map<string, Asset>()
let groups: AssetGroup[] = []

vi.mock('../../src/ui/feedback', () => ({
  notify,
  confirm: async () => true,
  errorMessage: (error: unknown) => String(error),
}))
vi.mock('../../src/services/unityService', () => ({
  unityService: { importAsset: vi.fn(async () => ({ projectPath: 'D:\\Games\\Haven', bridgeInstalled: false })) },
}))
vi.mock('../../src/services/coverService', () => ({ coverService: {} }))
vi.mock('../../src/services/modelFilesService', () => ({ modelFilesService: {} }))
vi.mock('../../src/services/settingsService', () => ({
  settingsService: { load: async () => ({}), save: async () => {} },
}))
vi.mock('../../src/services/libraryService', () => ({
  libraryService: {
    remove: async (ids: string[]) => {
      const assets = ids.map((id) => records.get(id)!)
      ids.forEach((id) => records.delete(id))
      return { assets, memberships: [] }
    },
    restore: async (assets: Asset[]) => {
      assets.forEach((asset) => records.set(asset.id, asset))
    },
  },
}))
vi.mock('../../src/services/organizationService', () => ({
  assetRecords: { getAll: async () => [...records.values()], update: async () => {}, updateMany: async () => {} },
  groupRecords: {
    getAll: async () => groups,
    save: async (group: AssetGroup) => {
      groups = groups.map((current) => (current.id === group.id ? group : current))
    },
    delete: async () => {},
  },
  tagRecords: { getAll: async () => [] },
}))

const asset: Asset = {
  id: 'a',
  name: 'Trees',
  fileName: 'Trees.unitypackage',
  filePath: 'D:\\Trees.unitypackage',
  fileSize: 1,
  assetKind: 'package',
  cover: 'none',
  notes: '',
  tagIds: [],
  isFavorite: false,
  createdAt: 0,
  updatedAt: 0,
  lastUsedAt: 0,
}

async function setup() {
  setActivePinia(createPinia())
  records.clear()
  records.set('a', { ...asset })
  groups = [{ id: 'g', name: 'Env', icon: 'folder', assetIds: ['a'], order: 1, createdAt: 0, source: 'manual' }]
  const { useAssetStore } = await import('../../src/stores/assetStore')
  const { useGroupStore } = await import('../../src/stores/groupStore')
  const { useBrowseStore } = await import('../../src/stores/browseStore')
  const { useAssetActions } = await import('../../src/composables/useAssetActions')
  const assets = useAssetStore()
  const groupStore = useGroupStore()
  await Promise.all([assets.load(), groupStore.load()])
  return { assets, groupStore, browse: useBrowseStore(), actions: useAssetActions() }
}

describe('useAssetActions', () => {
  it('offers an undo that brings a removed asset back', async () => {
    const { assets, actions } = await setup()
    await actions.removeFromLibrary(['a'])
    expect(assets.assets).toHaveLength(0)
    const [, , undo] = notify.withAction.mock.calls.at(-1) as [string, string, () => void]
    undo()
    await vi.waitFor(() => expect(assets.assets).toHaveLength(1))
  })

  it('removes from the selected manual group and can put it back', async () => {
    const { groupStore, browse, actions } = await setup()
    browse.toggleGroup('g')
    await actions.removeFromActiveGroup(['a'])
    expect(groupStore.groups[0]?.assetIds).toEqual([])
    const [, , undo] = notify.withAction.mock.calls.at(-1) as [string, string, () => void]
    undo()
    await vi.waitFor(() => expect(groupStore.groups[0]?.assetIds).toEqual(['a']))
  })

  it('tells where an import went', async () => {
    const { actions } = await setup()
    await actions.importToUnity(asset)
    expect(notify.success.mock.calls.at(-1)?.[0]).toContain('Haven')
  })
})
