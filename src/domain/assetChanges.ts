import type { Asset, AssetEdit } from '../types/asset'

/** One asset's user-editable fields before and after an edit. */
export interface AssetChange {
  id: string
  before: AssetEdit
  after: AssetEdit
}

/** An undoable user action: either edits of existing assets or removal from the library. */
export type HistoryEntry =
  | { kind: 'edit'; changes: AssetChange[] }
  | { kind: 'delete'; assets: Asset[]; memberships: Array<{ groupId: string; assetId: string }> }

/**
 * Builds changes for edits, skipping assets whose fields would not actually change, so undo
 * restores exactly what the user saw (e.g. tagging an asset that already had the tag is a no-op).
 */
export function diffEdits(assets: readonly Asset[], edit: (asset: Asset) => AssetEdit): AssetChange[] {
  const changes: AssetChange[] = []
  for (const asset of assets) {
    const after = edit(asset)
    const before: AssetEdit = {}
    let changed = false
    for (const key of Object.keys(after) as Array<keyof AssetEdit>) {
      if (!sameValue(asset[key], after[key])) changed = true
      Object.assign(before, { [key]: asset[key] })
    }
    if (changed) changes.push({ id: asset.id, before, after })
  }
  return changes
}

export const addTag =
  (tagId: string) =>
  (asset: Asset): AssetEdit =>
    asset.tagIds.includes(tagId) ? {} : { tagIds: [...asset.tagIds, tagId] }

export const removeTag =
  (tagId: string) =>
  (asset: Asset): AssetEdit =>
    asset.tagIds.includes(tagId) ? { tagIds: asset.tagIds.filter((id) => id !== tagId) } : {}

export const setFavorite = (isFavorite: boolean) => (): AssetEdit => ({ isFavorite })

function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((value, index) => value === right[index])
  return left === right
}
