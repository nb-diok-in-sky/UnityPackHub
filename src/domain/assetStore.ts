// Unity Asset Store links and product pages (pure parsing; fetching lives in services).

const ASSET_STORE_ORIGIN = 'https://assetstore.unity.com'

const PACKAGE_URL = /^https:\/\/assetstore\.unity\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?packages\/(?:package\/\d+|[^?#]+-\d+)(?:[?#].*)?$/i

/** Search URL for a package file name, without extension and version suffixes. */
export function assetStoreSearchUrl(assetName: string): string {
  const query = assetName
    .replace(/\.unitypackage$/i, '')
    .replace(/\b(v(?:er(?:sion)?)?\s*)?\d+(?:\.\d+){1,3}\b/gi, ' ')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${ASSET_STORE_ORIGIN}/?q=${encodeURIComponent(query)}&orderBy=1`
}

/** Package id of a product page URL, or null when the URL is not a product page. */
export function assetStorePackageId(url: string): string | null {
  const normalized = url.trim()
  if (!PACKAGE_URL.test(normalized)) return null
  return normalized.match(/\/package\/(\d+)/)?.[1] ?? normalized.match(/-(\d+)(?:[?#]|$)/)?.[1] ?? null
}

export function assetStoreProductPageUrl(packageId: string): string {
  return `${ASSET_STORE_ORIGIN}/packages/package/${packageId}?locale=en-US`
}

/** Title and cover image from a product page's OpenGraph tags. */
export function parseProductPage(html: string): { name: string; imageUrl: string } | null {
  const imageUrl = metaContent(html, 'og:image')
  const name = metaContent(html, 'og:title').split('|')[0]?.trim() ?? ''
  return imageUrl && name ? { name, imageUrl } : null
}

function metaContent(html: string, property: string): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const forward = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i')
  const reverse = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i')
  return decodeEntities(forward.exec(html)?.[1] ?? reverse.exec(html)?.[1] ?? '')
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const point = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(point) ? String.fromCodePoint(point) : match
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match
  })
}
