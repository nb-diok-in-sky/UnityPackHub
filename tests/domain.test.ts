import { describe, expect, it } from 'vitest'
import type { Asset, Tag } from '../src/types/asset'
import { queryAssets, searchText, type AssetQuery } from '../src/domain/assetQuery'
import { addTag, diffEdits, removeTag, setFavorite } from '../src/domain/assetChanges'
import { dataUrlToBlob, migrateAssetRecord } from '../src/domain/legacyRecords'
import { MODEL_PREVIEW_VERSION, modelCoverStatus, needsModelPreview } from '../src/domain/modelCover'
import { assetStorePackageId, assetStoreSearchUrl, parseProductPage } from '../src/domain/assetStore'
import { classifyModels } from '../src/domain/classification'
import { linkModelsToProject } from '../src/domain/unityLinking'
import { isAssetAvailable, isInsideDirectory, packagePreviewKey } from '../src/domain/paths'
import { normalizeSettings } from '../src/domain/settings'

function asset(id: string, extra: Partial<Asset> = {}): Asset {
  return {
    id, name: id, fileName: `${id}.unitypackage`, filePath: `D:\\${id}.unitypackage`, fileSize: 1, assetKind: 'package',
    cover: 'none', notes: '', tagIds: [], isFavorite: false, createdAt: 0, updatedAt: 0, lastUsedAt: 0, ...extra,
  }
}

const baseQuery: AssetQuery = {
  kind: 'package', search: '', favoritesOnly: false, tagId: null, groupAssetIds: null,
  modelCover: 'all', project: null, sortBy: 'name', sortOrder: 'asc',
}

describe('queryAssets', () => {
  const tags = new Map<string, Tag>([['t', { id: 't', label: 'Forest', color: '#000' }]])
  const assets = [asset('b'), asset('a', { tagIds: ['t'] }), asset('c', { isFavorite: true }), asset('m', { assetKind: 'model' })]
  const run = (query: Partial<AssetQuery>) =>
    queryAssets(assets, { ...baseQuery, ...query }, (item) => searchText(item, tags)).map((item) => item.id)

  it('filters by kind and puts favourites first', () => {
    expect(run({})).toEqual(['c', 'a', 'b'])
    expect(run({ sortOrder: 'desc' })).toEqual(['c', 'b', 'a'])
  })

  it('searches tag labels case-insensitively', () => {
    expect(run({ search: 'forest' })).toEqual(['a'])
  })

  it('applies tag and group filters', () => {
    expect(run({ tagId: 't' })).toEqual(['a'])
    expect(run({ groupAssetIds: new Set(['b']) })).toEqual(['b'])
  })
})

describe('asset changes', () => {
  it('records only assets that actually change', () => {
    const changes = diffEdits([asset('a', { tagIds: ['t'] }), asset('b')], addTag('t'))
    expect(changes).toEqual([{ id: 'b', before: { tagIds: [] }, after: { tagIds: ['t'] } }])
  })

  it('keeps the previous value for undo', () => {
    expect(diffEdits([asset('a', { tagIds: ['t', 'u'] })], removeTag('t'))[0]?.before).toEqual({ tagIds: ['t', 'u'] })
    expect(diffEdits([asset('a', { isFavorite: true })], setFavorite(true))).toEqual([])
  })
})

describe('legacy records', () => {
  it('converts database version 7 records', () => {
    const model = migrateAssetRecord({ ...asset('m', { assetKind: 'model' }), thumbnailPath: 'db', modelPreviewVersion: 4, modelPreviewEligible: false })
    expect(model.cover).toBe('stored')
    expect(model.modelPreview).toEqual({ version: 4, error: '', eligible: false })
    expect('thumbnailPath' in model).toBe(false)
    expect(migrateAssetRecord({ ...asset('p'), thumbnailPath: '' })).toMatchObject({ cover: 'none' })
    expect(migrateAssetRecord({ ...asset('p'), thumbnailPath: 'data:image/png;base64,AA==' }).cover).toBe('stored')
  })

  it('decodes base64 data URLs', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,AQID')
    expect(blob.type).toBe('image/png')
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3])
  })
})

describe('model covers', () => {
  const model = (extra: Partial<Asset>) => asset('m', { assetKind: 'model', ...extra })

  it('derives the cover status', () => {
    expect(modelCoverStatus(model({ modelPreview: { version: 0, error: '', eligible: false } }))).toBe('not-needed')
    expect(modelCoverStatus(model({ cover: 'stored', modelPreview: { version: MODEL_PREVIEW_VERSION, error: '', eligible: true } }))).toBe('completed')
    expect(modelCoverStatus(model({ modelPreview: { version: 0, error: 'boom', eligible: true } }))).toBe('failed')
    expect(modelCoverStatus(model({ modelPreview: { version: 0, error: '', eligible: true } }))).toBe('pending')
  })

  it('re-renders covers made by an older renderer', () => {
    expect(needsModelPreview(model({ modelPreview: { version: MODEL_PREVIEW_VERSION - 1, error: '', eligible: true } }))).toBe(true)
    expect(needsModelPreview(asset('p'))).toBe(false)
  })
})

describe('asset store links', () => {
  it('extracts package ids from both URL forms', () => {
    expect(assetStorePackageId('https://assetstore.unity.com/packages/3d/vegetation/trees/free-trees-12345')).toBe('12345')
    expect(assetStorePackageId('https://assetstore.unity.com/packages/package/678')).toBe('678')
    expect(assetStorePackageId('https://example.com/packages/package/678')).toBeNull()
  })

  it('strips versions from search queries', () => {
    expect(assetStoreSearchUrl('Forest Pack v1.8.8.unitypackage')).toBe('https://assetstore.unity.com/?q=Forest%20Pack&orderBy=1')
  })

  it('reads OpenGraph data and decodes entities', () => {
    const html = '<meta property="og:title" content="Rocks &amp; Cliffs | Unity Asset Store"><meta content="https://x/y.png" property="og:image">'
    expect(parseProductPage(html)).toEqual({ name: 'Rocks & Cliffs', imageUrl: 'https://x/y.png' })
  })
})

describe('classification', () => {
  it('matches by path, then by unique name', () => {
    const models = [asset('a', { assetKind: 'model', fileName: 'Oak.fbx', filePath: 'D:\\M\\Oak.fbx' }), asset('b', { assetKind: 'model', fileName: 'Rock.fbx', filePath: 'D:\\M\\Rock.fbx' })]
    const row = (originalName: string, path: string, inferredObject: string) =>
      ({ originalName, path, inferredObject, format: null, boundsText: null, sourceAsset: null, confidence: null })
    const result = classifyModels([row('Oak.fbx', 'd:/m/oak.fbx', 'Tree'), row('rock.FBX', '', 'Stone')], models)
    expect(Object.fromEntries(result.assetIdsByCategory)).toEqual({ Tree: ['a'], Stone: ['b'] })
  })
})

describe('unity linking', () => {
  const projectAsset = (guid: string, path: string) => ({ guid, path, fileName: path.split('/').pop() ?? '', assetType: 'GameObject', dependencies: [], sceneUsageCount: 0, referencedBy: [] })

  it('prefers the remembered GUID, reports ambiguous names', () => {
    const models = [asset('a', { assetKind: 'model', fileName: 'Oak.fbx' }), asset('b', { assetKind: 'model', fileName: 'Rock.fbx' })]
    const project = [projectAsset('g1', 'Assets/Moved/Oak.fbx'), projectAsset('g2', 'Assets/A/Rock.fbx'), projectAsset('g3', 'Assets/B/Rock.fbx')]
    const previous = [{ id: 'x', assetId: 'a', projectPath: 'P', unityGuid: 'g1', unityPath: 'Assets/Oak.fbx', matchMethod: 'path' as const, status: 'linked' as const, lastVerifiedAt: 0 }]
    const { states } = linkModelsToProject('P', models, project, previous)
    expect(states.get('a')?.projectAsset?.guid).toBe('g1')
    expect(states.get('b')?.status).toBe('ambiguous')
  })
})

describe('paths and settings', () => {
  it('keeps preview folder keys stable', () => {
    expect(packagePreviewKey('D:\\Packs\\Trees.unitypackage')).toBe(packagePreviewKey('D:/Packs/Trees.unitypackage'))
    expect(packagePreviewKey('D:\\Packs\\Trees.unitypackage')).toMatch(/^Trees--[0-9a-f]{8}$/)
    expect(isInsideDirectory('D:\\A\\b.fbx', 'D:\\A')).toBe(true)
  })

  it('hides assets of disabled or unreachable folders', () => {
    expect(isAssetAvailable({ filePath: 'D:\\A\\b.fbx' }, ['D:\\A'])).toBe(true)
    expect(isAssetAvailable({ filePath: 'D:\\A\\b.fbx' }, ['D:\\B'])).toBe(false)
    expect(isAssetAvailable({ filePath: 'D:\\A\\b.fbx', offline: true }, ['D:\\A'])).toBe(false)
  })

  it('fills missing settings with defaults', () => {
    const settings = normalizeSettings({ scanDirectories: [{ path: 'D:\\A', enabled: true }], classification: { jsonPath: 'x' } })
    expect(settings.classification).toEqual({ jsonPath: 'x', enabled: false })
    expect(settings.quickLinks.length).toBeGreaterThan(0)
    expect(normalizeSettings(null).cardSize).toBe('md')
  })
})
