// Export the whole library (with covers) to a folder, and restore it from one.
import {
  BACKUP_COVERS_DIR,
  BACKUP_DATA_FILE,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFolderName,
  coverFileName,
  parseBackup,
  type BackupCover,
  type BackupData,
} from '../domain/backup'
import { normalizeSettings } from '../domain/settings'
import { joinPath, parentDirectory } from '../domain/paths'
import type { UserSettings } from '../types/settings'
import { librarySnapshot } from '../data/repositories'
import { settingsFile } from '../data/settingsFile'
import { createDirectory, readBinaryFile, readTextFileAt, writeBinaryFileAt, writeTextFileAt } from '../platform/system'

export interface BackupSummary {
  folder: string
  assetCount: number
  coverCount: number
}

export const backupService = {
  /** Writes `<parent>/UnityPackHub-backup-<time>/` and returns where it went. */
  async export(parent: string, settings: UserSettings, now = new Date()): Promise<BackupSummary> {
    const folder = joinPath(parent, backupFolderName(now))
    const coversFolder = joinPath(folder, BACKUP_COVERS_DIR)
    await createDirectory(coversFolder)

    const covers: BackupCover[] = []
    await librarySnapshot.eachCover(async (id, image) => {
      const file = coverFileName(id, image.type)
      await writeBinaryFileAt(joinPath(coversFolder, file), new Uint8Array(await image.arrayBuffer()))
      covers.push({ id, file, type: image.type })
    })

    const snapshot = await librarySnapshot.read()
    const data: BackupData = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: now.getTime(),
      settings,
      ...snapshot,
      covers,
    }
    await writeTextFileAt(joinPath(folder, BACKUP_DATA_FILE), JSON.stringify(data, null, 2))
    return { folder, assetCount: snapshot.assets.length, coverCount: covers.length }
  },

  /** Reads and validates a backup's data.json without touching the library. */
  async inspect(dataFile: string): Promise<BackupData> {
    return parseBackup(JSON.parse(await readTextFileAt(dataFile)))
  },

  /** Replaces the library and settings with the backup. Covers whose file is missing are skipped. */
  async restore(dataFile: string, data: BackupData): Promise<void> {
    const coversFolder = joinPath(parentDirectory(dataFile), BACKUP_COVERS_DIR)
    const covers: Array<{ id: string; blob: Blob }> = []
    for (const cover of data.covers) {
      try {
        covers.push({
          id: cover.id,
          blob: new Blob([new Uint8Array(await readBinaryFile(joinPath(coversFolder, cover.file)))], {
            type: cover.type,
          }),
        })
      } catch {
        // A missing cover image only loses that picture, not the asset.
      }
    }
    const withCover = new Set(covers.map((cover) => cover.id))
    const assets = data.assets.map((asset) => ({
      ...asset,
      cover: withCover.has(asset.id) ? ('stored' as const) : ('none' as const),
    }))
    await librarySnapshot.replace({ ...data, assets }, covers)
    await settingsFile.save(normalizeSettings(data.settings))
  },
}
