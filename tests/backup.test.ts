import { describe, expect, it } from 'vitest'
import { BACKUP_FORMAT, backupFolderName, coverFileName, InvalidBackupError, parseBackup } from '../src/domain/backup'
import { joinPath, parentDirectory } from '../src/domain/paths'

const valid = {
  format: BACKUP_FORMAT, version: 1, exportedAt: 0, settings: {},
  assets: [{ id: 'a', filePath: 'D:\\A.unitypackage' }], tags: [], groups: [], unityAssetLinks: [], assetStoreLinks: [], covers: [],
}

describe('backup format', () => {
  it('accepts a well-formed backup', () => {
    expect(parseBackup(valid).assets).toHaveLength(1)
  })

  it('rejects foreign files, newer versions and missing tables', () => {
    expect(() => parseBackup({ ...valid, format: 'other' })).toThrow(InvalidBackupError)
    expect(() => parseBackup({ ...valid, version: 99 })).toThrow(InvalidBackupError)
    expect(() => parseBackup({ ...valid, tags: undefined })).toThrow(InvalidBackupError)
    expect(() => parseBackup({ ...valid, assets: [{ id: 1 }] })).toThrow(InvalidBackupError)
    expect(() => parseBackup(null)).toThrow(InvalidBackupError)
  })

  it('names folders and cover files predictably', () => {
    expect(backupFolderName(new Date(2026, 8, 30, 9, 5))).toBe('UnityPackHub-backup-20260930-0905')
    expect(coverFileName('id', 'image/jpeg')).toBe('id.jpg')
    expect(coverFileName('id', '')).toBe('id.bin')
  })
})

describe('path helpers', () => {
  it('joins with the separator the base already uses', () => {
    expect(joinPath('D:\\Backups\\', 'x', 'data.json')).toBe('D:\\Backups\\x\\data.json')
    expect(joinPath('/home/me', 'x')).toBe('/home/me/x')
    expect(parentDirectory('D:\\Backups\\x\\data.json')).toBe('D:\\Backups\\x')
  })
})
