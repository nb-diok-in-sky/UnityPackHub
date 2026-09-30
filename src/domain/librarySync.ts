import type { Asset } from '../types/asset'
import type { ScannedFile } from '../platform/backend'
import { initialModelPreview } from './modelCover'
import { isInsideDirectory } from './paths'

export interface LibrarySyncPlan {
  created: Asset[]
  /** Existing assets whose file moved or whose scan-derived fields changed. */
  updated: Array<{ id: string; patch: Partial<Asset> }>
  removedIds: string[]
}

/**
 * Reconciles the library with a fresh scan. Only directories in `scannedDirectories` are
 * authoritative. Assets under `unreachableDirectories` (unplugged drive, renamed folder) are
 * kept but marked offline, so they are hidden while their tags, notes and cover survive.
 */
export function planLibrarySync(
  existing: Asset[],
  scanned: ScannedFile[],
  scannedDirectories: string[],
  createId: () => string,
  now = Date.now(),
  unreachableDirectories: string[] = [],
): LibrarySyncPlan {
  const existingByPath = new Map(existing.map((asset) => [asset.filePath, asset]))
  const scannedPaths = new Set(scanned.map((file) => file.filePath))
  const patches = new Map<string, Partial<Asset>>()
  const addPatch = (id: string, patch: Partial<Asset>) => patches.set(id, { ...patches.get(id), ...patch })

  // Files that vanished from their old path are candidates for "moved": same name and size.
  const missingByIdentity = new Map<string, Asset[]>()
  for (const asset of existing) {
    if (scannedPaths.has(asset.filePath)) continue
    const key = identity(asset)
    missingByIdentity.set(key, [...(missingByIdentity.get(key) ?? []), asset])
  }

  const movedIds = new Set<string>()
  const created: Asset[] = []
  for (const file of scanned) {
    const current = existingByPath.get(file.filePath)
    if (current) {
      const eligibility = refreshedEligibility(current, file)
      if (eligibility) addPatch(current.id, eligibility)
      if (current.offline) addPatch(current.id, { offline: false })
      continue
    }
    const moved = missingByIdentity.get(identity(file))?.pop()
    if (moved) {
      movedIds.add(moved.id)
      addPatch(moved.id, {
        filePath: file.filePath,
        name: file.name,
        fileName: file.fileName,
        fileSize: file.fileSize,
        assetKind: file.assetKind,
        offline: false,
        updatedAt: now,
      })
      continue
    }
    created.push(newAsset(file, createId(), now))
  }

  const unmatched = existing.filter((asset) => !scannedPaths.has(asset.filePath) && !movedIds.has(asset.id))
  const removedIds = unmatched
    .filter((asset) => scannedDirectories.some((directory) => isInsideDirectory(asset.filePath, directory)))
    .map((asset) => asset.id)
  for (const asset of unmatched) {
    if (!asset.offline && unreachableDirectories.some((directory) => isInsideDirectory(asset.filePath, directory)))
      addPatch(asset.id, { offline: true })
  }

  const updated = [...patches].map(([id, patch]) => ({ id, patch }))
  return { created, updated, removedIds }
}

function identity(file: Pick<Asset, 'fileName' | 'fileSize'>): string {
  return `${file.fileSize}\0${file.fileName}`
}

/** Re-evaluates render eligibility for models that were never rendered. */
function refreshedEligibility(asset: Asset, file: ScannedFile): Partial<Asset> | null {
  if (file.assetKind !== 'model' || (asset.modelPreview?.version ?? 0) > 0) return null
  const next = initialModelPreview(file.filePath)
  if (asset.modelPreview?.eligible === next.eligible) return null
  return { modelPreview: { ...next, error: asset.modelPreview?.error ?? '' } }
}

function newAsset(file: ScannedFile, id: string, now: number): Asset {
  return {
    id,
    name: file.name,
    fileName: file.fileName,
    filePath: file.filePath,
    fileSize: file.fileSize,
    assetKind: file.assetKind,
    cover: 'none',
    ...(file.assetKind === 'model' ? { modelPreview: initialModelPreview(file.filePath) } : {}),
    notes: '',
    tagIds: [],
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: 0,
  }
}
