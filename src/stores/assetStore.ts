import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { Asset, AssetEdit } from '../types/asset'
import { diffEdits, type HistoryEntry } from '../domain/assetChanges'
import { MODEL_PREVIEW_VERSION } from '../domain/modelCover'
import { assetRecords } from '../services/organizationService'
import { libraryService } from '../services/libraryService'
import { unityService, type ImportResult } from '../services/unityService'
import { useCoverStore } from './coverStore'
import { useGroupStore } from './groupStore'

const MAX_HISTORY = 50

/**
 * The asset library in memory. Every user edit (tags, favourite, notes, removal) goes through
 * `edit` / `remove`, which record it for undo; automatic changes use `patch` and are not undoable.
 */
export const useAssetStore = defineStore('assets', () => {
  const assets = ref<Asset[]>([])
  const undoStack = shallowRef<HistoryEntry[]>([])
  const redoStack = shallowRef<HistoryEntry[]>([])

  const byId = computed(() => new Map(assets.value.map((asset) => [asset.id, asset])))

  async function load(): Promise<void> {
    assets.value = await assetRecords.getAll()
  }

  function applyLocally(id: string, patch: Partial<Asset>): void {
    const index = assets.value.findIndex((asset) => asset.id === id)
    if (index !== -1) assets.value[index] = { ...assets.value[index]!, ...patch }
  }

  /** Automatic, non-undoable change (covers, render state, usage time, scan results). */
  async function patch(id: string, change: Partial<Asset>): Promise<void> {
    const next = { ...change, updatedAt: Date.now() }
    await assetRecords.update(id, next)
    applyLocally(id, next)
  }

  async function applyEdits(updates: Array<{ id: string; edit: AssetEdit }>): Promise<void> {
    const now = Date.now()
    const records = updates.map(({ id, edit }) => ({ id, patch: { ...edit, updatedAt: now } }))
    await assetRecords.updateMany(records)
    for (const { id, patch: change } of records) applyLocally(id, change)
  }

  function record(entry: HistoryEntry): void {
    undoStack.value = [...undoStack.value, entry].slice(-MAX_HISTORY)
    redoStack.value = []
  }

  /** Applies a user edit to the given assets and records it for undo. */
  async function edit(ids: string[], change: (asset: Asset) => AssetEdit): Promise<void> {
    const targets = ids.map((id) => byId.value.get(id)).filter((asset): asset is Asset => !!asset)
    const changes = diffEdits(targets, change)
    if (changes.length === 0) return
    await applyEdits(changes.map(({ id, after }) => ({ id, edit: after })))
    record({ kind: 'edit', changes })
  }

  /** Removes assets from the library (files stay on disk); undoable until the next scan. */
  async function remove(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const removed = await libraryService.remove(ids)
    await dropLocally(ids)
    record({ kind: 'delete', assets: removed.assets, memberships: removed.memberships })
  }

  async function dropLocally(ids: string[]): Promise<void> {
    const removed = new Set(ids)
    assets.value = assets.value.filter((asset) => !removed.has(asset.id))
    await useGroupStore().load()
  }

  async function undo(): Promise<void> {
    const entry = undoStack.value.at(-1)
    if (!entry) return
    undoStack.value = undoStack.value.slice(0, -1)
    if (entry.kind === 'edit') await applyEdits(entry.changes.map(({ id, before }) => ({ id, edit: before })))
    else {
      await libraryService.restore(entry.assets, entry.memberships)
      await load()
      await useGroupStore().load()
    }
    redoStack.value = [...redoStack.value, entry]
  }

  async function redo(): Promise<void> {
    const entry = redoStack.value.at(-1)
    if (!entry) return
    redoStack.value = redoStack.value.slice(0, -1)
    if (entry.kind === 'edit') await applyEdits(entry.changes.map(({ id, after }) => ({ id, edit: after })))
    else {
      const ids = entry.assets.map((asset) => asset.id)
      await libraryService.remove(ids)
      await dropLocally(ids)
    }
    undoStack.value = [...undoStack.value, entry]
  }

  /** Called after a scan: assets were re-created or removed, so old history no longer applies. */
  function clearHistory(): void {
    undoStack.value = []
    redoStack.value = []
  }

  /** Stores a cover image; for models it also counts as a finished cover. */
  async function setCover(asset: Asset, image: Blob): Promise<void> {
    await useCoverStore().save(asset.id, image)
    await patch(asset.id, {
      cover: 'stored',
      ...(asset.modelPreview
        ? { modelPreview: { ...asset.modelPreview, version: MODEL_PREVIEW_VERSION, error: '' } }
        : {}),
    })
  }

  async function removeCover(asset: Asset): Promise<void> {
    await useCoverStore().remove(asset.id)
    await patch(asset.id, { cover: 'none' })
  }

  async function importToUnity(asset: Asset): Promise<ImportResult> {
    const result = await unityService.importAsset(asset)
    await patch(asset.id, { lastUsedAt: Date.now() })
    return result
  }

  return {
    assets,
    byId,
    canUndo: computed(() => undoStack.value.length > 0),
    canRedo: computed(() => redoStack.value.length > 0),
    load,
    patch,
    edit,
    remove,
    undo,
    redo,
    clearHistory,
    setCover,
    removeCover,
    importToUnity,
  }
})
