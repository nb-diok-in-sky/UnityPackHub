// Contents of .unitypackage files and the prefab previews Unity renders for them.
import { packagePreviewKey } from '../domain/paths'
import { backend, type PackageAssetList, type PreviewFolder, type RenderedPreviews } from '../platform/backend'
import { fileSize } from '../platform/system'
import { showcaseCacheRepository } from '../data/repositories'

/** Bump when the shape of PackageAssetList changes so stale cached listings are ignored. */
const LISTING_CACHE_VERSION = 6

const cacheKey = (packagePath: string) => `${packagePath}::v${LISTING_CACHE_VERSION}`

export const packageService = {
  /** Parses the package once; later calls reuse the cached listing until the file size changes. */
  async listAssets(packagePath: string, options: { refresh?: boolean } = {}): Promise<PackageAssetList> {
    if (options.refresh) await showcaseCacheRepository.deleteByPrefix(packagePath)
    const size = await fileSize(packagePath)
    if (size) {
      const cached = await showcaseCacheRepository.get<PackageAssetList>(cacheKey(packagePath), size)
      if (cached) return cached
    }
    const listing = await backend.parsePackageAssets(packagePath)
    if (size) await showcaseCacheRepository.put(cacheKey(packagePath), size, listing)
    return listing
  },

  /** Registers the package's prefabs with the Unity bridge; missing previews render in the open project. */
  requestPreviews(packagePath: string, listing: PackageAssetList): Promise<PreviewFolder> {
    const prefabs = listing.entries
      .filter((entry) => entry.assetType === 'Prefab')
      .map(({ pathname, filename }) => ({ pathname, filename }))
    return backend.requestPackagePreviews(packagePreviewKey(packagePath), prefabs)
  },

  readPreviewImages(packagePath: string): Promise<Record<string, string>> {
    return backend.readPackagePreviewImages(packagePreviewKey(packagePath))
  },

  renderedPreviews(packagePath: string): Promise<RenderedPreviews | null> {
    return backend.getRenderedPreviews(packagePreviewKey(packagePath))
  },

  clearAllPreviews(): Promise<number> {
    return backend.clearAllPreviews()
  },
}
