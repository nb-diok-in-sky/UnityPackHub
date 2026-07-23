import { fetch } from '@tauri-apps/plugin-http'
import { assetStoreLinkRepository } from './repositories'

const STORE_ORIGIN = 'https://assetstore.unity.com'
const PACKAGE_URL = /^https:\/\/assetstore\.unity\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?packages\/(?:package\/\d+|[^?#]+-\d+)(?:[?#].*)?$/i

export interface AssetStoreProduct {
  packageId: string
  name: string
  productUrl: string
  imageUrl: string
}

function decodeHtml(value: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = value
  return textarea.value
}

function metaContent(html: string, property: string): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const forward = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i')
  const reverse = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i')
  return decodeHtml(forward.exec(html)?.[1] ?? reverse.exec(html)?.[1] ?? '')
}

export function assetStoreSearchUrl(assetName: string): string {
  const query = assetName
    .replace(/\.unitypackage$/i, '')
    .replace(/\b(v(?:er(?:sion)?)?\s*)?\d+(?:\.\d+){1,3}\b/gi, ' ')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${STORE_ORIGIN}/?q=${encodeURIComponent(query)}&orderBy=1`
}

export async function resolveAssetStoreProduct(url: string): Promise<AssetStoreProduct> {
  const normalized = url.trim()
  if (!PACKAGE_URL.test(normalized)) {
    throw new Error('请输入 Unity Asset Store 的商品详情链接')
  }

  const packageId = normalized.match(/\/package\/(\d+)/)?.[1]
    ?? normalized.match(/-(\d+)(?:[?#]|$)/)?.[1]
  if (!packageId) throw new Error('无法识别该商品的 ID')

  const response = await fetch(`${STORE_ORIGIN}/packages/package/${packageId}?locale=en-US`, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0 Safari/537.36',
    },
    redirect: 'follow',
  })
  if (!response.ok) throw new Error(`Unity Asset Store 请求失败：HTTP ${response.status}`)

  const html = await response.text()
  const imageUrl = metaContent(html, 'og:image')
  const name = metaContent(html, 'og:title').split('|')[0]?.trim()
  if (!imageUrl || !name) throw new Error('该页面没有可用的官方封面信息')
  return { packageId, name, productUrl: response.url, imageUrl }
}

export async function downloadAssetStoreCover(product: AssetStoreProduct): Promise<Blob> {
  const response = await fetch(product.imageUrl)
  if (!response.ok) throw new Error(`封面下载失败：HTTP ${response.status}`)
  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) throw new Error('下载结果不是图片')
  return blob
}

export async function rememberAssetStoreLink(assetId: string, product: AssetStoreProduct): Promise<void> {
  await assetStoreLinkRepository.save({
    assetId,
    packageId: product.packageId,
    productName: product.name,
    productUrl: product.productUrl,
    imageUrl: product.imageUrl,
    linkedAt: Date.now(),
  })
}

export async function getRememberedAssetStoreLink(assetId: string): Promise<AssetStoreProduct | null> {
  const record = await assetStoreLinkRepository.get(assetId)
  return record
    ? {
        packageId: record.packageId,
        name: record.productName,
        productUrl: record.productUrl,
        imageUrl: record.imageUrl,
      }
    : null
}
