// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Asset } from '../../src/types/asset'
import { defaultSettings } from '../../src/domain/settings'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  withAction: vi.fn(),
}))
const scan = vi.hoisted(() => vi.fn())
const removeDirectory = vi.hoisted(() => vi.fn(async () => {}))
let stored: Asset[] = []

vi.mock('../../src/ui/feedback', () => ({
  notify,
  confirm: async () => true,
  errorMessage: (error: unknown) => String(error),
}))
vi.mock('../../src/services/settingsService', () => ({
  settingsService: { load: async () => defaultSettings(), save: async () => {} },
}))
vi.mock('../../src/services/libraryService', () => ({
  libraryService: {
    scan,
    removeDirectory,
    remove: async () => ({ assets: [], memberships: [] }),
    restore: async () => {},
  },
}))
vi.mock('../../src/services/classificationService', () => ({ classificationService: { clear: async () => {} } }))
vi.mock('../../src/services/organizationService', () => ({
  assetRecords: { getAll: async () => stored, update: async () => {}, updateMany: async () => {} },
  groupRecords: { getAll: async () => [], save: async () => {}, delete: async () => {} },
  tagRecords: { getAll: async () => [], save: async () => {}, delete: async () => [] },
}))
vi.mock('../../src/services/unityService', () => ({ unityService: {} }))
vi.mock('../../src/services/modelFilesService', () => ({ modelFilesService: {} }))
vi.mock('../../src/services/coverService', () => ({ coverService: {} }))

function asset(id: string, filePath: string, extra: Partial<Asset> = {}): Asset {
  return {
    id,
    name: id,
    fileName: `${id}.unitypackage`,
    filePath,
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

async function setup(directories: Array<{ path: string; enabled: boolean }>) {
  setActivePinia(createPinia())
  const { useSettingsStore } = await import('../../src/stores/settingsStore')
  const { useAssetStore } = await import('../../src/stores/assetStore')
  const { useBrowseStore } = await import('../../src/stores/browseStore')
  const { useLibraryStore } = await import('../../src/stores/libraryStore')
  const settings = useSettingsStore()
  await settings.load()
  settings.settings.scanDirectories = directories
  const assets = useAssetStore()
  await assets.load()
  return { settings, assets, browse: useBrowseStore(), library: useLibraryStore() }
}

describe('browseStore', () => {
  beforeEach(() => {
    stored = [
      asset('a', 'D:\\On\\a.unitypackage', { tagIds: ['t'] }),
      asset('b', 'D:\\On\\b.unitypackage'),
      asset('c', 'D:\\Off\\c.unitypackage'),
      asset('d', 'D:\\On\\d.unitypackage', { offline: true }),
    ]
  })

  it('hides assets of disabled and unreachable folders', async () => {
    const { browse } = await setup([
      { path: 'D:\\On', enabled: true },
      { path: 'D:\\Off', enabled: false },
    ])
    expect(browse.visibleAssets.map((item) => item.id)).toEqual(['a', 'b'])
    expect(browse.hiddenCount).toBe(2)
  })

  it('selects ranges in view order and resets every filter', async () => {
    const { browse } = await setup([{ path: 'D:\\On', enabled: true }])
    browse.toggleSelected('a')
    browse.selectRange('b')
    expect([...browse.selectedIds].sort()).toEqual(['a', 'b'])

    browse.toggleTag('t')
    browse.search = 'zzz'
    expect(browse.visibleAssets).toHaveLength(0)
    browse.resetFilters()
    expect(browse.visibleAssets).toHaveLength(2)
  })
})

describe('libraryStore', () => {
  beforeEach(() => {
    stored = []
    vi.clearAllMocks()
  })

  it('reports scan warnings instead of failing', async () => {
    scan.mockResolvedValue({
      warnings: [
        { kind: 'unreachable', directories: ['E:\\Gone'] },
        { kind: 'classification', message: 'bad table' },
      ],
    })
    const { library } = await setup([{ path: 'E:\\Gone', enabled: true }])
    await library.scan()
    expect(notify.warning).toHaveBeenCalledTimes(2)
    expect(notify.warning.mock.calls[0]?.[0]).toContain('E:\\Gone')
    expect(library.isScanning).toBe(false)
  })

  it('turns a failed scan into an error message', async () => {
    scan.mockRejectedValue(new Error('disk on fire'))
    const { library } = await setup([])
    await library.scan()
    expect(notify.error.mock.calls[0]?.[0]).toContain('disk on fire')
  })

  it('adds each folder once and forgets removed folders', async () => {
    scan.mockResolvedValue({ warnings: [] })
    const { library, settings } = await setup([])
    await library.addDirectory('D:\\A')
    await library.addDirectory('D:\\A')
    expect(settings.settings.scanDirectories).toEqual([{ path: 'D:\\A', enabled: true }])
    expect(scan).toHaveBeenCalledTimes(1)

    await library.removeDirectory('D:\\A')
    expect(settings.settings.scanDirectories).toEqual([])
    expect(removeDirectory).toHaveBeenCalledWith('D:\\A', [])
  })
})
