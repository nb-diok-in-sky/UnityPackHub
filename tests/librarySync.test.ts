import { describe, expect, it } from 'vitest'
import type { Asset } from '../src/types/asset'
import type { ScannedFile } from '../src/platform/backend'
import { planLibrarySync } from '../src/domain/librarySync'

function asset(id: string, filePath: string, extra: Partial<Asset> = {}): Asset {
  const fileName = filePath.split('\\').pop() ?? filePath
  return {
    id, name: fileName, fileName, filePath, fileSize: 100, assetKind: 'package', cover: 'none',
    notes: '', tagIds: [], isFavorite: false, createdAt: 0, updatedAt: 0, lastUsedAt: 0, ...extra,
  }
}

function scanned(filePath: string, fileSize = 100, assetKind: ScannedFile['assetKind'] = 'package'): ScannedFile {
  const fileName = filePath.split('\\').pop() ?? filePath
  return { name: fileName.replace(/\.\w+$/, ''), fileName, filePath, fileSize, assetKind }
}

let counter = 0
const newId = () => `new-${++counter}`

describe('planLibrarySync', () => {
  it('keeps assets of folders that could not be read, marked offline', () => {
    const existing = [asset('a', 'E:\\Unity_Asset\\Trees.unitypackage', { tagIds: ['tag'] })]
    const plan = planLibrarySync(existing, [], [], newId, 0, ['E:\\Unity_Asset'])
    expect(plan.removedIds).toEqual([])
    expect(plan.updated).toEqual([{ id: 'a', patch: { offline: true } }])
  })

  it('brings offline assets back once their folder is readable again', () => {
    const existing = [asset('a', 'E:\\Unity_Asset\\Trees.unitypackage', { offline: true })]
    const plan = planLibrarySync(existing, [scanned('E:\\Unity_Asset\\Trees.unitypackage')], ['E:\\Unity_Asset'], newId)
    expect(plan.updated).toEqual([{ id: 'a', patch: { offline: false } }])
  })

  it('removes assets whose file disappeared from a scanned folder', () => {
    const existing = [asset('a', 'D:\\Assets\\Gone.unitypackage')]
    expect(planLibrarySync(existing, [], ['D:\\Assets'], newId).removedIds).toEqual(['a'])
  })

  it('does not treat a folder as the prefix of a sibling folder', () => {
    const existing = [asset('a', 'D:\\Assets2\\Other.unitypackage')]
    expect(planLibrarySync(existing, [], ['D:\\Assets'], newId).removedIds).toEqual([])
  })

  it('matches folders case-insensitively and with either slash', () => {
    const existing = [asset('a', 'D:\\Assets\\Gone.unitypackage')]
    expect(planLibrarySync(existing, [], ['d:/assets/'], newId).removedIds).toEqual(['a'])
  })

  it('follows a moved file instead of recreating it, keeping id and user data', () => {
    const existing = [asset('a', 'D:\\Old\\Trees.unitypackage', { notes: 'keep me' })]
    const plan = planLibrarySync(existing, [scanned('D:\\New\\Trees.unitypackage')], ['D:\\Old', 'D:\\New'], newId)
    expect(plan.created).toEqual([])
    expect(plan.removedIds).toEqual([])
    expect(plan.updated).toEqual([expect.objectContaining({ id: 'a', patch: expect.objectContaining({ filePath: 'D:\\New\\Trees.unitypackage' }) })])
  })

  it('creates new files with render eligibility for models', () => {
    const plan = planLibrarySync([], [scanned('D:\\M\\Tree.fbx', 10, 'model'), scanned('D:\\M\\Animations\\Walk.fbx', 10, 'model')], ['D:\\M'], newId)
    expect(plan.created.map((created) => created.modelPreview?.eligible)).toEqual([true, false])
    expect(plan.created[0]).toMatchObject({ cover: 'none', tagIds: [], assetKind: 'model' })
  })
})
