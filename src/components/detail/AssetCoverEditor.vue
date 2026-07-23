<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { readFile } from '@tauri-apps/plugin-fs'
import type { Asset } from '../../types/asset'
import { useAssetStore } from '../../stores/assetStore'
import { useThumbnailStore } from '../../stores/thumbnailStore'
import { useI18n } from '../../services/i18n'
import { setAssetCoverFromBlob, setAssetCoverFromDataUrl } from '../../services/assetCoverService'

const props = defineProps<{ asset: Asset }>()
const assetStore = useAssetStore()
const thumbnails = useThumbnailStore()
const { t } = useI18n()
const isDragOver = ref(false)
let unlistenDragDrop: (() => void) | null = null

const coverSrc = computed(() => {
  const blobUrl = thumbnails.getUrl(props.asset.id)
  if (blobUrl) return blobUrl
  return props.asset.thumbnailPath.startsWith('data:') ? props.asset.thumbnailPath : ''
})

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico', '.tiff']
const MIME_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon', tiff: 'image/tiff',
}

async function setFromPath(path: string): Promise<void> {
  const data = await readFile(path)
  const extension = path.split('.').pop()?.toLowerCase() ?? 'png'
  await setAssetCoverFromBlob(props.asset, new Blob([data], { type: MIME_TYPES[extension] ?? 'image/png' }))
}

async function setFromUrl(url: string): Promise<void> {
  const { fetch } = await import('@tauri-apps/plugin-http')
  await setAssetCoverFromBlob(props.asset, await (await fetch(url)).blob())
}

async function setFromFile(file?: File): Promise<void> {
  if (file?.type.startsWith('image/')) await setAssetCoverFromBlob(props.asset, file)
}

async function handlePaste(event: ClipboardEvent): Promise<void> {
  const image = [...(event.clipboardData?.items ?? [])].find((item) => item.type.startsWith('image/'))?.getAsFile()
  if (image) {
    event.preventDefault()
    await setFromFile(image)
    return
  }
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (/^https?:\/\/.+\.(png|jpe?g|gif|webp|bmp|svg)/i.test(text)) {
    event.preventDefault()
    await setFromUrl(text)
  }
}

async function handleDrop(event: DragEvent): Promise<void> {
  event.preventDefault()
  isDragOver.value = false
  const data = event.dataTransfer
  if (!data) return
  const cover = data.getData('application/cover-image')
  if (cover) return setAssetCoverFromDataUrl(props.asset, cover)
  if (data.files[0]) return setFromFile(data.files[0])
  const imageUrl = data.getData('text/uri-list') || data.getData('text/plain')
  if (/^https?:\/\//i.test(imageUrl)) await setFromUrl(imageUrl)
}

async function remove(): Promise<void> {
  await thumbnails.remove(props.asset.id)
  await assetStore.updateAsset(props.asset.id, { thumbnailPath: '' })
}

onMounted(async () => {
  const { getCurrentWebview } = await import('@tauri-apps/api/webview')
  unlistenDragDrop = await getCurrentWebview().onDragDropEvent(async ({ payload }) => {
    if (payload.type === 'enter' || payload.type === 'over') isDragOver.value = true
    if (payload.type === 'leave') isDragOver.value = false
    if (payload.type === 'drop') {
      isDragOver.value = false
      const path = payload.paths.find((value) => IMAGE_EXTENSIONS.some((ext) => value.toLowerCase().endsWith(ext)))
      if (path) await setFromPath(path)
    }
  })
  window.addEventListener('paste', handlePaste)
})

onUnmounted(() => {
  unlistenDragDrop?.()
  window.removeEventListener('paste', handlePaste)
})
</script>

<template>
  <div
    class="asset-cover"
    :class="{ 'asset-cover--dragover': isDragOver }"
    @dragover.prevent="isDragOver = true"
    @dragleave="isDragOver = false"
    @drop="handleDrop"
  >
    <img v-if="coverSrc" :src="coverSrc" :alt="asset.name" class="asset-cover__image" />
    <div v-else class="asset-cover__placeholder">
      <q-icon name="add_photo_alternate" size="32px" color="grey-5" />
      <span>{{ t.coverDropHint }}</span>
    </div>
    <input type="file" accept="image/*" class="asset-cover__input" @change="setFromFile(($event.target as HTMLInputElement).files?.[0])" />
    <q-btn v-if="coverSrc" flat round dense icon="close" size="xs" class="asset-cover__remove" @click.stop="remove" />
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;
.asset-cover { position: relative; width: 100%; height: 194px; min-height: 194px; flex: 0 0 194px; border-radius: $radius-card; overflow: hidden; background: $color-divider; cursor: pointer; border: 2px dashed transparent; transition: $transition-fast; }
.asset-cover--dragover { border-color: $apple-blue; background: var(--accent-soft); }
.asset-cover__image { width: 100%; height: 100%; object-fit: cover; }
.asset-cover__placeholder { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; font-size: 12px; color: $color-secondary; }
.asset-cover__input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.asset-cover__remove { position: absolute; top: 6px; right: 6px; background: var(--cover-remove-bg) !important; color: white !important; }
</style>
