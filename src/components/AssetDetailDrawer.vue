<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { Asset, Tag } from '../types/asset'
import { useAssetStore } from '../stores/assetStore'
import { useTagStore } from '../stores/tagStore'
import { useThumbnailStore } from '../stores/thumbnailStore'
import { useI18n } from '../services/i18n'
import { importToUnity, openFileLocation, detectUnityProject } from '../services/unityImporter'
import { formatBytes } from '../utils/formatBytes'
import { readFile } from '@tauri-apps/plugin-fs'
import TagPill from './TagPill.vue'
import ShowcaseSection from './detail/ShowcaseSection.vue'
import ModelShowcaseSection from './detail/ModelShowcaseSection.vue'
import UnityPreviewsSection from './detail/UnityPreviewsSection.vue'

const props = defineProps<{
  asset: Asset | null
}>()

const emit = defineEmits<{
  close: []
}>()

const assetStore = useAssetStore()
const tagStore = useTagStore()
const thumbnailStore = useThumbnailStore()
const { t } = useI18n()

const coverSrc = computed(() => {
  if (!props.asset) return ''
  const blobUrl = thumbnailStore.getUrl(props.asset.id)
  if (blobUrl) return blobUrl
  const tp = props.asset.thumbnailPath
  if (tp && tp.startsWith('data:')) return tp
  return ''
})

const isEditingNotes = ref(false)
const editNotesValue = ref('')
const notesInputRef = ref<HTMLTextAreaElement | null>(null)
const isDragOver = ref(false)
const showTagMenu = ref(false)
const isImporting = ref(false)
const importStatus = ref('')

const showcaseRef = ref<InstanceType<typeof ShowcaseSection> | null>(null)
const modelShowcaseRef = ref<InstanceType<typeof ModelShowcaseSection> | null>(null)
const previewsRef = ref<InstanceType<typeof UnityPreviewsSection> | null>(null)

const isPackage = computed(() => !props.asset || props.asset.assetKind !== 'model')
const isModel = computed(() => props.asset?.assetKind === 'model')

const assetTags = computed(() => {
  if (!props.asset) return []
  return props.asset.tagIds
    .map((id) => tagStore.getTagById(id))
    .filter((t): t is Tag => t !== undefined)
})

const availableTags = computed(() => {
  if (!props.asset) return []
  return tagStore.tags.filter((t) => !props.asset!.tagIds.includes(t.id))
})

const fileSizeDisplay = computed(() =>
  props.asset ? formatBytes(props.asset.fileSize) : ''
)

const createdDateDisplay = computed(() => {
  if (!props.asset) return ''
  return new Date(props.asset.createdAt).toLocaleDateString('zh-CN')
})

watch(() => props.asset, () => {
  isEditingNotes.value = false
  showTagMenu.value = false
})

watch(() => props.asset?.id, () => {
  importStatus.value = ''
  showcaseRef.value?.reset()
  modelShowcaseRef.value?.reset()
  previewsRef.value?.reset()
  if (props.asset) {
    previewsRef.value?.loadPreviews()
  }
})

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico', '.tiff']

let unlistenDragDrop: (() => void) | null = null

onMounted(async () => {
  const { getCurrentWebview } = await import('@tauri-apps/api/webview')
  unlistenDragDrop = await getCurrentWebview().onDragDropEvent(async (event) => {
    if (event.payload.type === 'enter' || event.payload.type === 'over') {
      if (props.asset) isDragOver.value = true
    } else if (event.payload.type === 'leave') {
      isDragOver.value = false
    } else if (event.payload.type === 'drop') {
      isDragOver.value = false
      if (!props.asset) return
      const imgPath = event.payload.paths.find(p =>
        IMAGE_EXTENSIONS.some(ext => p.toLowerCase().endsWith(ext))
      )
      if (imgPath) await setCoverFromPath(imgPath)
    }
  })

  window.addEventListener('paste', handlePaste)
})

onUnmounted(() => {
  unlistenDragDrop?.()
  window.removeEventListener('paste', handlePaste)
})

async function handlePaste(event: ClipboardEvent): Promise<void> {
  if (!props.asset) return
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault()
      const file = item.getAsFile()
      if (file) {
        await setCoverFromFile(file)
        return
      }
    }
  }

  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (/^https?:\/\/.+\.(png|jpe?g|gif|webp|bmp|svg)/i.test(text)) {
    event.preventDefault()
    await setCoverFromUrl(text)
  }
}

async function setCoverFromPath(filePath: string): Promise<void> {
  if (!props.asset) return
  try {
    const data = await readFile(filePath)
    const ext = filePath.split('.').pop()?.toLowerCase() ?? 'png'
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
      svg: 'image/svg+xml', ico: 'image/x-icon', tiff: 'image/tiff',
    }
    const blob = new Blob([data], { type: mimeMap[ext] ?? 'image/png' })
    await thumbnailStore.setFromBlob(props.asset.id, blob)
    await assetStore.updateAsset(props.asset.id, { thumbnailPath: 'db' })
  } catch (err) {
    console.error('[Cover] Failed to read file:', err)
  }
}

function startEditNotes(): void {
  if (!props.asset) return
  editNotesValue.value = props.asset.notes
  isEditingNotes.value = true
  nextTick(() => {
    notesInputRef.value?.focus()
  })
}

async function saveNotes(): Promise<void> {
  if (!props.asset) return
  isEditingNotes.value = false
  if (editNotesValue.value !== props.asset.notes) {
    await assetStore.updateAsset(props.asset.id, { notes: editNotesValue.value })
  }
}

async function handleCoverDrop(event: DragEvent): Promise<void> {
  event.preventDefault()
  isDragOver.value = false
  if (!props.asset || !event.dataTransfer) return

  const coverDataUrl = event.dataTransfer.getData('application/cover-image')
  if (coverDataUrl) {
    await thumbnailStore.setFromDataUrl(props.asset.id, coverDataUrl)
    await assetStore.updateAsset(props.asset.id, { thumbnailPath: 'db' })
    return
  }

  if (event.dataTransfer.files.length > 0) {
    const file = event.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      await setCoverFromFile(file)
      return
    }
  }

  const html = event.dataTransfer.getData('text/html')
  if (html) {
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/)
    if (match?.[1]) {
      await setCoverFromUrl(match[1])
      return
    }
  }

  const url = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain')
  if (url && /^https?:\/\/.+\.(png|jpe?g|gif|webp|bmp|svg)/i.test(url)) {
    await setCoverFromUrl(url)
  }
}

async function handleCoverSelect(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  if (!props.asset || !input.files?.length) return
  const file = input.files[0]
  if (!file) return
  await setCoverFromFile(file)
  input.value = ''
}

async function setCoverFromFile(file: File): Promise<void> {
  if (!props.asset) return
  await thumbnailStore.setFromBlob(props.asset.id, file)
  await assetStore.updateAsset(props.asset.id, { thumbnailPath: 'db' })
}

async function setCoverFromUrl(url: string): Promise<void> {
  if (!props.asset) return
  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    const response = await tauriFetch(url)
    const blob = await response.blob()
    await thumbnailStore.setFromBlob(props.asset.id, blob)
    await assetStore.updateAsset(props.asset.id, { thumbnailPath: 'db' })
  } catch (err) {
    console.error('[Cover] Failed to fetch image from URL:', err)
  }
}

async function removeCover(): Promise<void> {
  if (!props.asset) return
  await thumbnailStore.remove(props.asset.id)
  await assetStore.updateAsset(props.asset.id, { thumbnailPath: '' })
}

async function addTag(tagId: string): Promise<void> {
  if (!props.asset) return
  const newTagIds = [...props.asset.tagIds, tagId]
  await assetStore.updateAsset(props.asset.id, { tagIds: newTagIds })
  showTagMenu.value = false
}

async function removeTag(tagId: string): Promise<void> {
  if (!props.asset) return
  const newTagIds = props.asset.tagIds.filter((id) => id !== tagId)
  await assetStore.updateAsset(props.asset.id, { tagIds: newTagIds })
}

async function toggleFavorite(): Promise<void> {
  if (!props.asset) return
  await assetStore.toggleFavorite(props.asset.id)
}

async function handleImportToUnity(): Promise<void> {
  if (!props.asset || isImporting.value) return
  isImporting.value = true
  importStatus.value = ''
  try {
    const projectPath = await detectUnityProject()
    if (projectPath) {
      const result = await importToUnity(props.asset.filePath, projectPath)
      if (!result.success) {
        console.error('Import failed:', result.message)
        return
      }
      importStatus.value = result.newlyInjected ? t.bridgeInjected : t.bridgeDetected
    } else {
      await importToUnity(props.asset.filePath)
    }
  } finally {
    isImporting.value = false
  }
}

async function handleOpenFileLocation(): Promise<void> {
  if (!props.asset) return
  await openFileLocation(props.asset.filePath)
}

function stripVersionSuffix(name: string): string {
  return name
    .replace(/[\s_-]*v?\d+(\.\d+){0,3}[\s_-]*$/i, '')
    .trim()
}

async function handleSearchUnityStore(): Promise<void> {
  if (!props.asset) return
  const cleanName = stripVersionSuffix(props.asset.name)
  const query = encodeURIComponent(cleanName)
  const url = `https://assetstore.unity.com/?q=${query}&orderBy=1`
  const { open } = await import('@tauri-apps/plugin-shell')
  await open(url)
}

</script>

<template>
  <Transition name="drawer">
    <div v-if="asset" class="detail-drawer-overlay" @click.self="emit('close')">
      <div class="detail-panel">
        <div class="detail-panel__header">
          <span class="detail-panel__title">{{ t.details }}</span>
          <q-btn flat round dense icon="close" size="sm" @click="emit('close')" />
        </div>

        <div class="detail-panel__scroll">
          <!-- Cover Image -->
          <div
            class="detail-panel__cover"
            :class="{ 'detail-panel__cover--dragover': isDragOver }"
            @dragover.prevent="isDragOver = true"
            @dragleave="isDragOver = false"
            @drop="handleCoverDrop"
          >
            <img
              v-if="coverSrc"
              :src="coverSrc"
              :alt="asset.name"
              class="detail-panel__cover-img"
            />
            <div v-else class="detail-panel__cover-placeholder">
              <q-icon name="add_photo_alternate" size="32px" color="grey-5" />
              <span>{{ t.coverDropHint }}</span>
            </div>
            <input
              type="file"
              accept="image/*"
              class="detail-panel__cover-input"
              @change="handleCoverSelect"
            />
            <q-btn
              v-if="coverSrc"
              flat round dense
              icon="close"
              size="xs"
              class="detail-panel__cover-remove"
              @click.stop="removeCover"
            />
          </div>

          <!-- Name -->
          <div class="detail-panel__section">
            <h3 class="detail-panel__name">{{ asset.name }}</h3>
            <q-btn
              flat round dense
              :icon="asset.isFavorite ? 'star' : 'star_border'"
              :color="asset.isFavorite ? 'amber' : 'grey-5'"
              size="sm"
              @click="toggleFavorite"
            />
          </div>

          <!-- Action Buttons -->
          <div class="detail-panel__actions">
            <q-btn
              unelevated dense no-caps icon="download"
              :label="isImporting ? t.importing : t.importToUnity"
              :loading="isImporting" color="primary"
              class="detail-panel__action-btn"
              @click="handleImportToUnity"
            />
            <q-btn
              outline dense no-caps icon="folder_open"
              :label="t.openFileLocation" color="grey-7"
              class="detail-panel__action-btn"
              @click="handleOpenFileLocation"
            />
            <q-btn
              outline dense no-caps icon="storefront"
              label="Unity 商店搜索"
              color="grey-7"
              class="detail-panel__action-btn"
              @click="handleSearchUnityStore"
            />
            <div v-if="importStatus" class="detail-panel__bridge-status">
              <q-icon name="check_circle" color="positive" size="14px" />
              <span>{{ importStatus }}</span>
            </div>
          </div>

          <!-- Notes -->
          <div class="detail-panel__section detail-panel__section--vertical">
            <span class="detail-panel__label">{{ t.notes }}</span>
            <div v-if="isEditingNotes" class="detail-panel__notes-edit">
              <textarea
                ref="notesInputRef"
                v-model="editNotesValue"
                class="detail-panel__notes-textarea"
                rows="4"
                :placeholder="t.notesPlaceholder"
                @blur="saveNotes"
                @keydown.ctrl.enter="saveNotes"
              />
            </div>
            <div v-else class="detail-panel__notes-display" @dblclick="startEditNotes">
              <span v-if="asset.notes">{{ asset.notes }}</span>
              <span v-else class="detail-panel__notes-placeholder" @click="startEditNotes">
                {{ t.notesPlaceholder }}
              </span>
            </div>
          </div>

          <!-- Tags -->
          <div class="detail-panel__section detail-panel__section--vertical">
            <div class="detail-panel__label-row">
              <span class="detail-panel__label">{{ t.tags }}</span>
              <q-btn
                flat round dense icon="add" size="xs" color="grey-7"
                @click="showTagMenu = !showTagMenu"
              />
            </div>

            <div class="detail-panel__tags">
              <div v-for="tag in assetTags" :key="tag.id" class="detail-panel__tag-item">
                <TagPill :tag="tag" />
                <q-btn
                  flat round dense icon="close" size="8px" color="grey-5"
                  class="detail-panel__tag-remove"
                  @click="removeTag(tag.id)"
                />
              </div>
              <span v-if="assetTags.length === 0" class="detail-panel__empty-hint">
                {{ t.noTags }}
              </span>
            </div>

            <div v-if="showTagMenu && availableTags.length > 0" class="detail-panel__tag-picker">
              <button
                v-for="tag in availableTags" :key="tag.id"
                class="detail-panel__tag-option"
                @click="addTag(tag.id)"
              >
                <span class="detail-panel__tag-dot" :style="{ background: tag.color }" />
                {{ tag.label }}
              </button>
            </div>
          </div>

          <!-- File Info -->
          <div class="detail-panel__section detail-panel__section--vertical">
            <span class="detail-panel__label">{{ t.fileInfo }}</span>
            <div class="detail-panel__info-grid">
              <span class="detail-panel__info-key">{{ t.fileName }}</span>
              <span class="detail-panel__info-value">{{ asset.fileName }}</span>
              <span class="detail-panel__info-key">{{ t.fileSize }}</span>
              <span class="detail-panel__info-value">{{ fileSizeDisplay }}</span>
              <span class="detail-panel__info-key">{{ t.dateAdded }}</span>
              <span class="detail-panel__info-value">{{ createdDateDisplay }}</span>
              <span class="detail-panel__info-key">{{ t.filePath }}</span>
              <span class="detail-panel__info-value detail-panel__info-path" :title="asset.filePath">
                {{ asset.filePath }}
              </span>
            </div>
          </div>

          <!-- Package Asset Showcase -->
          <ShowcaseSection v-if="isPackage" ref="showcaseRef" :asset="asset" />

          <!-- Model Showcase -->
          <ModelShowcaseSection v-if="isModel" ref="modelShowcaseRef" :asset="asset" />

          <!-- Unity Rendered Previews (package only) -->
          <UnityPreviewsSection v-if="isPackage" ref="previewsRef" :asset="asset" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.detail-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: var(--overlay-bg);
}

.detail-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 380px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: $color-surface;
  font-family: $font-family;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
  border-left: 1px solid $color-border;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid $color-border;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: $color-text;
  }

  &__scroll {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  &__cover {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: $radius-card;
    overflow: hidden;
    background: $color-divider;
    cursor: pointer;
    transition: $transition-fast;
    border: 2px dashed transparent;

    &--dragover {
      border-color: $apple-blue;
      background: var(--accent-soft);
    }
  }

  &__cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 12px;
    color: $color-secondary;
  }

  &__cover-input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  &__cover-remove {
    position: absolute;
    top: 6px;
    right: 6px;
    background: var(--cover-remove-bg) !important;
    color: white !important;
  }

  &__section {
    display: flex;
    align-items: center;
    gap: 8px;

    &--vertical {
      flex-direction: column;
      align-items: stretch;
    }
  }

  &__name {
    flex: 1;
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: $color-text;
    word-break: break-word;
  }

  &__label {
    font-size: 11px;
    font-weight: 600;
    color: $color-secondary;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  &__label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__notes-display {
    padding: 8px 10px;
    border-radius: $radius-input;
    font-size: 13px;
    color: $color-text;
    line-height: 1.5;
    min-height: 40px;
    cursor: text;
    transition: $transition-fast;

    &:hover {
      background: var(--hover-overlay-subtle);
    }
  }

  &__notes-placeholder {
    color: $color-secondary;
    cursor: pointer;
  }

  &__notes-edit {
    width: 100%;
  }

  &__notes-textarea {
    width: 100%;
    border: 1px solid $color-border;
    border-radius: $radius-input;
    padding: 8px 10px;
    font-size: 13px;
    font-family: $font-family;
    color: $color-text;
    resize: vertical;
    outline: none;
    line-height: 1.5;

    &:focus {
      border-color: $apple-blue;
      box-shadow: 0 0 0 3px var(--accent-glow);
    }
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 28px;
    align-items: center;
  }

  &__tag-item {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  &__tag-remove {
    opacity: 0;
    transition: $transition-fast;

    .detail-panel__tag-item:hover & {
      opacity: 1;
    }
  }

  &__empty-hint {
    font-size: 12px;
    color: $color-secondary;
  }

  &__tag-picker {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    background: $color-surface;
    border: 1px solid $color-border;
    border-radius: $radius-input;
    box-shadow: $shadow-dropdown;
  }

  &__tag-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: $color-text;

    &:hover {
      background: var(--hover-overlay);
    }
  }

  &__tag-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__info-grid {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 6px 12px;
    font-size: 12px;
  }

  &__info-key {
    color: $color-secondary;
  }

  &__info-value {
    color: $color-text;
    word-break: break-all;
  }

  &__info-path {
    font-size: 11px;
    color: $color-secondary;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__action-btn {
    border-radius: $radius-button;
    font-size: 13px;
    padding: 6px 12px;
  }

  &__bridge-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: $color-secondary;
    padding: 2px 0;
  }
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;

  .detail-panel {
    transition: transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);
  }
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;

  .detail-panel {
    transform: translateX(100%);
  }
}
</style>
