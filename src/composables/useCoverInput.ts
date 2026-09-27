import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import type { Asset } from '../types/asset'
import { coverService, isImagePath } from '../services/coverService'
import { fileService } from '../services/fileService'
import { useAssetStore } from '../stores/assetStore'
import { useI18n } from '../i18n'
import { errorMessage, notify } from '../ui/feedback'

const IMAGE_URL = /^https?:\/\/.+\.(png|jpe?g|gif|webp|bmp|svg)/i

/** Every way to set a cover while the detail drawer is open: file drop, paste, picker, drag from the showcase. */
export function useCoverInput(asset: Ref<Asset>) {
  const assets = useAssetStore()
  const { tr } = useI18n()
  const isDragOver = ref(false)
  let unlisten: (() => void) | null = null
  let disposed = false

  async function apply(image: () => Promise<Blob> | Blob): Promise<void> {
    try {
      await assets.setCover(asset.value, await image())
    } catch (error) {
      notify.error(tr('coverFailed', { reason: errorMessage(error) }))
    }
  }

  async function fromFile(file?: File | null): Promise<void> {
    if (file?.type.startsWith('image/')) await apply(() => file)
  }

  async function handlePaste(event: ClipboardEvent): Promise<void> {
    const image = [...(event.clipboardData?.items ?? [])].find((item) => item.type.startsWith('image/'))?.getAsFile()
    if (image) {
      event.preventDefault()
      return fromFile(image)
    }
    const text = event.clipboardData?.getData('text/plain') ?? ''
    if (IMAGE_URL.test(text)) {
      event.preventDefault()
      await apply(() => coverService.imageFromUrl(text))
    }
  }

  /** HTML drops: covers dragged from the showcase, or images dragged from a browser. */
  async function handleDrop(event: DragEvent): Promise<void> {
    event.preventDefault()
    isDragOver.value = false
    const data = event.dataTransfer
    if (!data) return
    const cover = data.getData('application/cover-image')
    if (cover) return apply(() => coverService.imageFromDataUrl(cover))
    if (data.files[0]) return fromFile(data.files[0])
    const url = data.getData('text/uri-list') || data.getData('text/plain')
    if (/^https?:\/\//i.test(url)) await apply(() => coverService.imageFromUrl(url))
  }

  onMounted(async () => {
    window.addEventListener('paste', handlePaste)
    // Files dragged from Explorer arrive through Tauri, not as HTML drop events.
    const stop = await fileService.onFileDrop((event) => {
      if (event.type === 'enter' || event.type === 'over') isDragOver.value = true
      if (event.type === 'leave') isDragOver.value = false
      if (event.type !== 'drop') return
      isDragOver.value = false
      const path = event.paths.find(isImagePath)
      if (path) void apply(() => coverService.imageFromFile(path))
    })
    if (disposed) stop()
    else unlisten = stop
  })

  onUnmounted(() => {
    disposed = true
    unlisten?.()
    window.removeEventListener('paste', handlePaste)
  })

  return { isDragOver, fromFile, handleDrop, remove: () => assets.removeCover(asset.value) }
}
