// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Asset } from '../../src/types/asset'
import { defaultSettings } from '../../src/domain/settings'
import type { ModelCoverRun } from '../../src/services/modelPreviewService'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  withAction: vi.fn(),
}))
const unity = vi.hoisted(() => ({
  detectProject: vi.fn(async (): Promise<string | null> => 'D:\\Games\\Haven'),
  bridgeStatus: vi.fn(async () => 'offline'),
  installBridge: vi.fn(async () => true),
  discoverEditors: vi.fn(async (): Promise<string[]> => ['C:\\Unity.exe']),
  importAsset: vi.fn(),
}))
const runPreviews = vi.hoisted(() => vi.fn())
const records = new Map<string, Asset>()

vi.mock('../../src/ui/feedback', () => ({
  notify,
  confirm: async () => true,
  errorMessage: (error: unknown) => String(error),
}))
vi.mock('../../src/services/unityService', () => ({ unityService: unity }))
vi.mock('../../src/services/modelPreviewService', () => ({
  modelPreviewService: { run: runPreviews, cancel: vi.fn() },
}))
vi.mock('../../src/services/settingsService', () => ({
  settingsService: { load: async () => defaultSettings(), save: async () => {} },
}))
vi.mock('../../src/services/coverService', () => ({
  coverService: { save: async () => {}, remove: async () => {}, load: async () => undefined },
}))
vi.mock('../../src/services/libraryService', () => ({ libraryService: {} }))
vi.mock('../../src/services/organizationService', () => ({
  assetRecords: {
    getAll: async () => [...records.values()],
    update: async (id: string, patch: Partial<Asset>) => {
      records.set(id, { ...records.get(id)!, ...patch })
    },
    updateMany: async () => {},
  },
  groupRecords: { getAll: async () => [] },
  tagRecords: { getAll: async () => [] },
}))

function model(id: string): Asset {
  return {
    id,
    name: id,
    fileName: `${id}.fbx`,
    filePath: `D:\\M\\${id}.fbx`,
    fileSize: 1,
    assetKind: 'model',
    cover: 'none',
    modelPreview: { version: 0, error: '', eligible: true },
    notes: '',
    tagIds: [],
    isFavorite: false,
    createdAt: 0,
    updatedAt: 0,
    lastUsedAt: 0,
  }
}

describe('unityConnectionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shows the detected project and its bridge state', async () => {
    const { useUnityConnectionStore } = await import('../../src/stores/unityConnectionStore')
    const store = useUnityConnectionStore()
    await store.refresh()
    expect(store.projectName).toBe('Haven')
    expect(store.status).toBe('offline')

    unity.detectProject.mockResolvedValueOnce(null)
    await store.refresh()
    expect(store.projectPath).toBeNull()
  })

  it('installs the bridge and waits until Unity loaded it', async () => {
    vi.useFakeTimers()
    try {
      const { useUnityConnectionStore } = await import('../../src/stores/unityConnectionStore')
      const store = useUnityConnectionStore()
      await store.refresh()
      unity.bridgeStatus.mockResolvedValueOnce('offline').mockResolvedValueOnce('outdated').mockResolvedValue('ready')
      const connecting = store.connect()
      await vi.advanceTimersByTimeAsync(3000)
      expect(await connecting).toBe('ready')
      expect(unity.installBridge).toHaveBeenCalledWith('D:\\Games\\Haven')
      expect(store.connecting).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('modelCoverStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    records.clear()
    for (const id of ['ok', 'mesh', 'crash']) records.set(id, model(id))
  })

  it('applies each outcome and stops retrying meshless files', async () => {
    runPreviews.mockImplementation(async (run: ModelCoverRun) => {
      await run.onOutcome({ assetId: 'ok', image: new Blob() })
      await run.onOutcome({ assetId: 'mesh', error: 'No renderable mesh was found.' })
      await run.onOutcome({ assetId: 'crash', error: 'Unity exited' })
    })
    const { useAssetStore } = await import('../../src/stores/assetStore')
    const { useModelCoverStore } = await import('../../src/stores/modelCoverStore')
    const assets = useAssetStore()
    await assets.load()
    const job = useModelCoverStore()
    await job.start(assets.assets, 10)

    expect(job.progress).toEqual({ total: 3, completed: 3, succeeded: 1, failed: 2 })
    expect(records.get('ok')?.cover).toBe('stored')
    expect(records.get('mesh')?.modelPreview).toMatchObject({ eligible: false })
    expect(records.get('crash')?.modelPreview).toMatchObject({ eligible: true, error: 'Unity exited' })
    expect(notify.warning).toHaveBeenCalled()
  })

  it('asks for an editor when none can be found', async () => {
    unity.discoverEditors.mockResolvedValueOnce([])
    const { useModelCoverStore } = await import('../../src/stores/modelCoverStore')
    await useModelCoverStore().start([model('x')], 1)
    expect(runPreviews).not.toHaveBeenCalled()
    expect(notify.warning).toHaveBeenCalled()
  })
})
