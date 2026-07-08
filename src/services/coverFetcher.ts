import { invoke } from '@tauri-apps/api/core'
import { stat } from '@tauri-apps/plugin-fs'
import { db } from './database'

const SHOWCASE_CACHE_VERSION = 5

export async function fetchCoverFromPackage(packagePath: string): Promise<string | null> {
  try {
    const preview = await invoke<string | null>('extract_package_preview', { path: packagePath })
    return preview
  } catch {
    return null
  }
}

export interface PackageContents {
  files: string[]
  preview: string | null
  file_count: number
}

export async function parsePackageContents(packagePath: string): Promise<PackageContents | null> {
  try {
    return await invoke<PackageContents>('parse_unity_package', { path: packagePath })
  } catch {
    return null
  }
}

export interface PackageAssetEntry {
  guid: string
  pathname: string
  filename: string
  extension: string
  asset_type: string
  preview: string | null
  has_asset_data: boolean
}

export interface PackageAssetList {
  entries: PackageAssetEntry[]
  total_count: number
}

export async function parsePackageAssets(packagePath: string): Promise<PackageAssetList | null> {
  try {
    let fileSize = 0
    try {
      const fileInfo = await stat(packagePath)
      fileSize = fileInfo.size
    } catch (statErr) {
      console.warn('[Showcase] stat failed, skipping cache:', statErr)
    }

    if (fileSize > 0) {
      const cacheKey = `${packagePath}::v${SHOWCASE_CACHE_VERSION}`
      try {
        const cached = await db.showcaseCache.get(cacheKey)
        if (cached && cached.fileSize === fileSize) {
          console.log('[Showcase] cache hit')
          return JSON.parse(cached.data) as PackageAssetList
        }
      } catch (cacheErr) {
        console.warn('[Showcase] cache read failed:', cacheErr)
      }
    }

    console.log('[Showcase] invoking parse_package_assets...')
    const result = await invoke<PackageAssetList>('parse_package_assets', { path: packagePath })
    console.log('[Showcase] got', result.total_count, 'entries')

    if (fileSize > 0) {
      const cacheKey = `${packagePath}::v${SHOWCASE_CACHE_VERSION}`
      try {
        await db.showcaseCache.put({
          filePath: cacheKey,
          fileSize,
          parsedAt: Date.now(),
          data: JSON.stringify(result),
        })
      } catch (cacheErr) {
        console.warn('[Showcase] cache write failed:', cacheErr)
      }
    }

    return result
  } catch (err) {
    console.error('[Showcase] parsePackageAssets failed:', err)
    return null
  }
}

export async function clearShowcaseCache(packagePath?: string): Promise<void> {
  try {
    if (packagePath) {
      const keys = await db.showcaseCache.toCollection().primaryKeys()
      const matching = keys.filter(k => (k as string).startsWith(packagePath))
      if (matching.length > 0) {
        await db.showcaseCache.bulkDelete(matching)
      }
    } else {
      await db.showcaseCache.clear()
    }
  } catch (err) {
    console.warn('[Showcase] clear cache failed:', err)
  }
}

export async function extractSingleAsset(
  packagePath: string,
  guid: string,
  targetDir: string,
): Promise<string[]> {
  return await invoke<string[]>('extract_single_asset', {
    request: { package_path: packagePath, guid, target_dir: targetDir },
  })
}
