// Cached package listings from older app versions are dropped; current ones are kept.
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { db } from '../src/data/database'
import { showcaseCacheRepository } from '../src/data/repositories'

describe('showcase cache', () => {
  it('prunes entries written by older listing versions', async () => {
    await showcaseCacheRepository.put('A.unitypackage::v5', 1, { old: true })
    await showcaseCacheRepository.put('A.unitypackage::v7', 1, { current: true })
    await showcaseCacheRepository.put('B.unitypackage::v6', 1, { old: true })
    expect(await showcaseCacheRepository.deleteUnlessSuffix('::v7')).toBe(2)
    expect((await db.showcaseCache.toCollection().primaryKeys()).sort()).toEqual(['A.unitypackage::v7'])
    expect(await showcaseCacheRepository.get('A.unitypackage::v7', 1)).toEqual({ current: true })
  })
})
