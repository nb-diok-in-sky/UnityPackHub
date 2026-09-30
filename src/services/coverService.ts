// Cover images: stored as blobs in IndexedDB, keyed by asset id.
import { coverRepository } from '../data/repositories'
import { fetchImage, httpGet, readBinaryFile } from '../platform/system'
import { appFileUrl } from '../platform/backend'
import { dataUrlToBlob } from '../domain/legacyRecords'

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  tiff: 'image/tiff',
}

const IMAGE_EXTENSIONS = Object.keys(MIME_TYPES)

export function isImagePath(path: string): boolean {
  return IMAGE_EXTENSIONS.includes(path.split('.').pop()?.toLowerCase() ?? '')
}

export const coverService = {
  load: (assetId: string): Promise<Blob | undefined> => coverRepository.get(assetId),
  save: (assetId: string, image: Blob): Promise<void> => coverRepository.save(assetId, image),
  remove: (assetId: string): Promise<void> => coverRepository.delete([assetId]),

  async imageFromFile(path: string): Promise<Blob> {
    const extension = path.split('.').pop()?.toLowerCase() ?? 'png'
    return new Blob([new Uint8Array(await readBinaryFile(path))], { type: MIME_TYPES[extension] ?? 'image/png' })
  },

  async imageFromUrl(url: string): Promise<Blob> {
    const response = await httpGet(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const image = await response.blob()
    if (!image.type.startsWith('image/')) throw new Error('The downloaded file is not an image')
    return image
  },

  imageFromDataUrl: dataUrlToBlob,

  /** A file under the app data folder (Unity renders, extracted package previews). */
  imageFromAppFile: (path: string): Promise<Blob> => fetchImage(appFileUrl(path)),

  /** A URL the page already displays, e.g. a thumbnail dragged from the showcase. */
  imageFromPageUrl: (url: string): Promise<Blob> =>
    url.startsWith('data:') ? Promise.resolve(dataUrlToBlob(url)) : fetchImage(url),
}
