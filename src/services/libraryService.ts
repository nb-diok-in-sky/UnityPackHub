// Keeping the library (IndexedDB) in step with the folders on disk.
import { v4 as uuid } from 'uuid'
import type { Asset } from '../types/asset'
import type { ScanDirectory } from '../types/settings'
import { planLibrarySync } from '../domain/librarySync'
import { isInsideDirectory } from '../domain/paths'
import { backend } from '../platform/backend'
import { assetRepository, assetStoreLinkRepository, coverRepository, groupRepository } from '../data/repositories'
import { classificationService } from './classificationService'

/** Problems that did not stop the scan. */
export type ScanWarning =
  | { kind: 'unreachable'; directories: string[] }
  | { kind: 'classification'; message: string }

export interface ScanOutcome {
  warnings: ScanWarning[]
}

export interface GroupMembership { groupId: string; assetId: string }

export const libraryService = {
  async scan(directories: ScanDirectory[], classificationJsonPath: string): Promise<ScanOutcome> {
    const enabled = directories.filter((directory) => directory.enabled).map((directory) => directory.path)
    const result = await backend.scanDirectories(enabled)
    const warnings: ScanWarning[] = []
    const unreachable = enabled.filter((directory) => !result.scannedDirectories.includes(directory))
    if (unreachable.length > 0) warnings.push({ kind: 'unreachable', directories: unreachable })

    const plan = planLibrarySync(await assetRepository.getAll(), result.files, result.scannedDirectories, uuid, Date.now(), unreachable)
    if (plan.created.length > 0) await assetRepository.put(plan.created)
    if (plan.updated.length > 0) await assetRepository.updateMany(plan.updated)
    await this.removePermanently(plan.removedIds)

    const assets = await assetRepository.getAll()
    await coverRepository.deleteOrphans(new Set(assets.map((asset) => asset.id)))
    if (classificationJsonPath) {
      try {
        await classificationService.sync(classificationJsonPath, assets)
      } catch (error) {
        warnings.push({ kind: 'classification', message: error instanceof Error ? error.message : String(error) })
      }
    }
    return { warnings }
  },

  /** Drops the assets of a scan folder the user removed from the settings. */
  async removeDirectory(directory: string, remainingDirectories: string[]): Promise<void> {
    const assets = await assetRepository.getAll()
    await this.removePermanently(assets
      .filter((asset) => isInsideDirectory(asset.filePath, directory)
        && !remainingDirectories.some((remaining) => isInsideDirectory(asset.filePath, remaining)))
      .map((asset) => asset.id))
  },

  /** Removes assets and everything attached to them. Not undoable. */
  async removePermanently(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await assetRepository.delete(ids)
    await coverRepository.delete(ids)
    await assetStoreLinkRepository.delete(ids)
    await groupRepository.removeMembers(new Set(ids))
  },

  /** Removes assets from the library but keeps their covers, so the removal can be undone. */
  async remove(ids: string[]): Promise<{ assets: Asset[]; memberships: GroupMembership[] }> {
    const assets = await assetRepository.getMany(ids)
    const removed = new Set(ids)
    const memberships = (await groupRepository.getAll()).flatMap((group) =>
      group.assetIds.filter((id) => removed.has(id)).map((assetId) => ({ groupId: group.id, assetId })))
    await assetRepository.delete(ids)
    await groupRepository.removeMembers(removed)
    return { assets, memberships }
  },

  async restore(assets: Asset[], memberships: GroupMembership[]): Promise<void> {
    await assetRepository.put(assets)
    const groups = await groupRepository.getAll()
    await Promise.all(groups.map((group) => {
      const restored = memberships.filter((membership) => membership.groupId === group.id).map((membership) => membership.assetId)
      return restored.length > 0 ? groupRepository.update(group.id, { assetIds: [...new Set([...group.assetIds, ...restored])] }) : undefined
    }))
  },
}
