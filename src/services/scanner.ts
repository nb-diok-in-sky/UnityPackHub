import type { Asset, AssetKind, ScanDirectory } from '../types/asset'
import { assetRepository, groupRepository } from './repositories'
import { v4 as uuidv4 } from 'uuid'
import { eventBus } from './eventBus'
import { commands } from './tauriCommands'
import { classificationService } from './classificationService'

export class ScanService {
  async scanDirectories(
    directories: ScanDirectory[],
    classificationJsonPath = '',
  ): Promise<Asset[]> {
    const enabledDirs = directories.filter((d) => d.enabled)
    const dirPaths = enabledDirs.map((d) => d.path)

    let scannedFiles
    try {
      scannedFiles = await commands.scanDirectories(dirPaths)
    } catch (error) {
      eventBus.emit('scan:error', { message: `Scan failed: ${String(error)}` })
      throw error
    }

    const discoveredAssets: Asset[] = scannedFiles.map((f) => ({
      id: uuidv4(),
      name: f.name,
      fileName: f.fileName,
      filePath: f.filePath,
      fileSize: f.fileSize,
      thumbnailPath: '',
      notes: '',
      tagIds: [],
      isFavorite: false,
      assetKind: (f.assetKind === 'model' ? 'model' : 'package') as AssetKind,
      ...(f.assetKind === 'model' ? { modelPreviewEligible: isLikelyRenderableModel(f.filePath) } : {}),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastUsedAt: 0,
    }))

    await this.syncWithDatabase(discoveredAssets, new Set(dirPaths))
    if (classificationJsonPath) {
      const syncedAssets = await assetRepository.getAll()
      await classificationService.sync(classificationJsonPath, syncedAssets)
    }
    eventBus.emit('scan:complete', { count: discoveredAssets.length })
    return discoveredAssets
  }

  private async syncWithDatabase(
    scannedAssets: Asset[],
    successfulDirs: Set<string>,
  ): Promise<void> {
    const existingAssets = await assetRepository.getAll()
    const existingByPath = new Map(existingAssets.map((a) => [a.filePath, a]))
    const scannedPaths = new Set(scannedAssets.map((a) => a.filePath))

    const newAssets = scannedAssets.filter((a) => !existingByPath.has(a.filePath))

    await Promise.all(scannedAssets.map(async (scanned) => {
      const existing = existingByPath.get(scanned.filePath)
      if (!existing || scanned.assetKind !== 'model') return
      if (existing.modelPreviewVersion) return
      if (scanned.modelPreviewEligible === undefined) return
      if (existing.modelPreviewEligible === scanned.modelPreviewEligible) return
      await assetRepository.update(existing.id, {
        modelPreviewEligible: scanned.modelPreviewEligible,
        updatedAt: Date.now(),
      })
    }))

    const movedAssets: Array<{ existing: Asset; scanned: Asset }> = []
    const orphanNew = newAssets.filter((a) => {
      for (const existing of existingAssets) {
        if (scannedPaths.has(existing.filePath)) continue
        if (existing.fileName === a.fileName && existing.fileSize === a.fileSize) {
          existingByPath.delete(existing.filePath)
          scannedPaths.add(existing.filePath)
          movedAssets.push({ existing, scanned: a })
          return false
        }
      }
      return true
    })

    await Promise.all(movedAssets.map(({ existing, scanned }) =>
      assetRepository.update(existing.id, {
        filePath: scanned.filePath,
        name: scanned.name,
        fileName: scanned.fileName,
        fileSize: scanned.fileSize,
        assetKind: scanned.assetKind,
        updatedAt: Date.now(),
      })
    ))

    if (orphanNew.length > 0) {
      await assetRepository.bulkCreate(orphanNew)
    }

    const removedIds = existingAssets
      .filter((a) => {
        if (scannedPaths.has(a.filePath)) return false
        for (const dir of successfulDirs) {
          if (a.filePath.startsWith(dir)) return true
        }
        return false
      })
      .map((a) => a.id)
    if (removedIds.length > 0) {
      await assetRepository.bulkDelete(removedIds)
      const removed = new Set(removedIds)
      const groups = await groupRepository.getAll()
      await Promise.all(groups.map(async (group) => {
        const assetIds = group.assetIds.filter((assetId) => !removed.has(assetId))
        if (assetIds.length !== group.assetIds.length) {
          await groupRepository.update(group.id, { assetIds })
        }
      }))
    }
  }
}

function isLikelyRenderableModel(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase()
  const fileName = normalized.split('/').pop() ?? ''
  const isAnimationDirectory = /\/(animation|animations|anim|motion|motions)\//.test(normalized)
  const isAnimationName = /^@/.test(fileName)
    || /(^|[_-])(idle|walk|run|attack|skill|motion|anim|strafing|meditate|pickup|greet)([_-]|\.)/.test(fileName)
  return !(isAnimationDirectory || isAnimationName)
}

export const scanService = new ScanService()
