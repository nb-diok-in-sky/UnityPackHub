// Contents of .unitypackage files and the prefab previews Unity renders for them.
import { joinPath, packagePreviewKey } from '../domain/paths'
import {
  appFileUrl,
  backend,
  onPackagePreviewsChanged,
  type PackageAssetList,
  type PreviewFolder,
  type RenderedPreviews,
} from '../platform/backend'
import { fileSize } from '../platform/system'
import { showcaseCacheRepository } from '../data/repositories'

/** Bump when the shape of PackageAssetList changes so stale cached listings are ignored. */
const LISTING_CACHE_VERSION = 7

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

  listPreviewFiles(packagePath: string): Promise<string[]> {
    return backend.listPackagePreviewFiles(packagePreviewKey(packagePath))
  },

  /** Calls `handler` whenever Unity writes new previews for this package. */
  onPreviewsChanged(packagePath: string, handler: () => void): Promise<() => void> {
    const key = packagePreviewKey(packagePath)
    return onPackagePreviewsChanged((changed) => {
      if (changed === key) handler()
    })
  },

  /** URL for a file inside a preview folder; `version` defeats the image cache after a re-render. */
  previewUrl(folder: string, file: string, version = 0): string {
    return `${appFileUrl(joinPath(folder, file))}?v=${version}`
  },

  embeddedPreviewUrl(previewPath: string | null): string | null {
    return previewPath ? appFileUrl(previewPath) : null
  },

  renderedPreviews(packagePath: string): Promise<RenderedPreviews | null> {
    return backend.getRenderedPreviews(packagePreviewKey(packagePath))
  },

  clearAllPreviews(): Promise<number> {
    return backend.clearAllPreviews()
  },
}
