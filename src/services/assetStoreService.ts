// Official covers from the Unity Asset Store product page the user links to.
import type { AssetStoreProduct } from '../types/asset'
import { assetStorePackageId, assetStoreProductPageUrl, parseProductPage } from '../domain/assetStore'
import { httpGet } from '../platform/system'
import { assetStoreLinkRepository } from '../data/repositories'

const PAGE_HEADERS = {
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.8',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0 Safari/537.36',
}

export class AssetStoreError extends Error {
  constructor(readonly reason: 'invalid-url' | 'request-failed' | 'no-cover', readonly status?: number) {
    super(reason)
  }
}

export const assetStoreService = {
  async resolveProduct(url: string): Promise<AssetStoreProduct> {
    const packageId = assetStorePackageId(url)
    if (!packageId) throw new AssetStoreError('invalid-url')
    const response = await httpGet(assetStoreProductPageUrl(packageId), PAGE_HEADERS)
    if (!response.ok) throw new AssetStoreError('request-failed', response.status)
    const page = parseProductPage(await response.text())
    if (!page) throw new AssetStoreError('no-cover')
    return { packageId, name: page.name, imageUrl: page.imageUrl, productUrl: response.url }
  },

  async remembered(assetId: string): Promise<AssetStoreProduct | null> {
    const record = await assetStoreLinkRepository.get(assetId)
    return record ? { packageId: record.packageId, name: record.productName, productUrl: record.productUrl, imageUrl: record.imageUrl } : null
  },

  async remember(assetId: string, product: AssetStoreProduct): Promise<void> {
    await assetStoreLinkRepository.save({
      assetId,
      packageId: product.packageId,
      productName: product.name,
      productUrl: product.productUrl,
      imageUrl: product.imageUrl,
      linkedAt: Date.now(),
    })
  },
}
