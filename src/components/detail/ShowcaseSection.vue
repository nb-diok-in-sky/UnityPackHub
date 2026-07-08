<script setup lang="ts">
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import type { Asset } from '../../types/asset'
import { useI18n } from '../../services/i18n'
import { parsePackageAssets, clearShowcaseCache } from '../../services/coverFetcher'
import type { PackageAssetEntry, PackageAssetList } from '../../services/coverFetcher'

const SHOWCASE_TYPES = ['Prefab', 'Texture', 'Script'] as const
type ShowcaseType = typeof SHOWCASE_TYPES[number]

const props = defineProps<{
  asset: Asset
}>()

const { t } = useI18n()

interface PreviewDirInfo {
  path: string
  existing_files: string[]
}

const showcaseData = ref<PackageAssetList | null>(null)
const isLoading = ref(false)
const isOpen = ref(false)
const activeFilter = ref<'All' | ShowcaseType>('All')
const packagePreviewDir = ref('')
const previewImages = ref<Map<string, string>>(new Map())

function getPackageSlug(filePath: string): string {
  const name = filePath.replace(/\\/g, '/').split('/').pop() || 'unknown'
  return name.replace(/\.unitypackage$/i, '')
}

async function ensurePreviewDir(): Promise<void> {
  const slug = getPackageSlug(props.asset.filePath)
  const prefabNames = showcaseData.value
    ? showcaseData.value.entries
        .filter(e => e.asset_type === 'Prefab')
        .map(e => e.filename)
    : []
  const info = await invoke<PreviewDirInfo>('ensure_preview_dir', {
    packageName: slug,
    prefabNames,
  })
  packagePreviewDir.value = info.path

  if (info.existing_files.length > 0) {
    const images = await invoke<Record<string, string>>('read_all_previews', {
      previewDir: info.path,
    })
    previewImages.value = new Map(Object.entries(images))
    console.log('[Showcase] preview dir:', info.path, 'loaded:', previewImages.value.size, 'images')
  } else {
    previewImages.value = new Map()
    console.log('[Showcase] preview dir:', info.path, 'no previews yet')
  }
}

const showcaseEntries = computed(() => {
  if (!showcaseData.value) return []
  return showcaseData.value.entries.filter(e => SHOWCASE_TYPES.includes(e.asset_type as ShowcaseType))
})

const filteredEntries = computed(() => {
  if (activeFilter.value === 'All') return showcaseEntries.value
  return showcaseEntries.value.filter(e => e.asset_type === activeFilter.value)
})

const typeCounts = computed(() => {
  const counts: Record<string, number> = { All: showcaseEntries.value.length }
  for (const type of SHOWCASE_TYPES) {
    counts[type] = showcaseEntries.value.filter(e => e.asset_type === type).length
  }
  return counts
})

function getThumbSrc(entry: PackageAssetEntry): string | null {
  if (entry.asset_type === 'Prefab') {
    const expectedFile = `${entry.filename}.png`
    return previewImages.value.get(expectedFile) || null
  }
  if (entry.preview) {
    return entry.preview
  }
  return null
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'Prefab': return 'widgets'
    case 'Texture': return 'image'
    case 'Script': return 'description'
    default: return 'insert_drive_file'
  }
}

async function handleToggle(): Promise<void> {
  if (isOpen.value) {
    isOpen.value = false
    return
  }
  if (!showcaseData.value) {
    isLoading.value = true
    try {
      showcaseData.value = await parsePackageAssets(props.asset.filePath)
      await ensurePreviewDir()
    } finally {
      isLoading.value = false
    }
  }
  isOpen.value = true
}

async function handleRefresh(): Promise<void> {
  showcaseData.value = null
  isLoading.value = true
  try {
    await clearShowcaseCache(props.asset.filePath)
    showcaseData.value = await parsePackageAssets(props.asset.filePath)
    await ensurePreviewDir()
  } finally {
    isLoading.value = false
  }
}

async function handleClearAllPreviews(): Promise<void> {
  try {
    const count = await invoke<number>('clear_all_previews')
    console.log(`[Showcase] cleared ${count} preview files`)
    showcaseData.value = null
    packagePreviewDir.value = ''
    isOpen.value = false
  } catch (err) {
    console.error('[Showcase] clear previews failed:', err)
  }
}

function reset(): void {
  showcaseData.value = null
  isOpen.value = false
  activeFilter.value = 'All'
  packagePreviewDir.value = ''
  previewImages.value = new Map()
}

defineExpose({ reset })
</script>

<template>
  <div class="showcase-section">
    <div class="showcase-section__header">
      <span class="showcase-section__title">{{ t.assetShowcase }}</span>
      <div class="showcase-section__header-actions">
        <q-btn
          v-if="isOpen"
          flat round dense icon="delete_sweep" size="xs" color="grey-7"
          title="清除所有预览图"
          @click="handleClearAllPreviews"
        />
        <q-btn
          v-if="isOpen"
          flat round dense icon="refresh" size="xs" color="grey-7"
          title="刷新"
          @click="handleRefresh"
        />
        <q-btn
          flat round dense
          :icon="isOpen ? 'expand_less' : 'expand_more'"
          size="xs" color="grey-7"
          :loading="isLoading"
          @click="handleToggle"
        />
      </div>
    </div>

    <div v-if="isLoading" class="showcase-section__loading">
      <q-spinner-dots size="20px" color="primary" />
      <span>{{ t.loadingContents }}</span>
    </div>

    <template v-if="isOpen && showcaseData">
      <!-- Type Filter Chips -->
      <div class="showcase-section__filters">
        <button
          v-for="type in (['All', ...SHOWCASE_TYPES] as const)"
          :key="type"
          class="showcase-chip"
          :class="{ 'showcase-chip--active': activeFilter === type }"
          @click="activeFilter = type"
        >
          <q-icon v-if="type !== 'All'" :name="getTypeIcon(type)" size="12px" />
          {{ type === 'All' ? t.assetTypeAll : t[`assetType${type}` as keyof typeof t] }}
          <span class="showcase-chip__count">{{ typeCounts[type] || 0 }}</span>
        </button>
      </div>

      <!-- Count -->
      <div class="showcase-section__count">
        {{ filteredEntries.length }} / {{ showcaseEntries.length }}
      </div>

      <!-- Card Grid -->
      <div class="showcase-grid">
        <div
          v-for="entry in filteredEntries"
          :key="entry.guid"
          class="showcase-card"
          :title="entry.pathname"
          :draggable="!!getThumbSrc(entry)"
          @dragstart="(e: DragEvent) => { const src = getThumbSrc(entry); if (src && e.dataTransfer) { e.dataTransfer.setData('application/cover-image', src); e.dataTransfer.effectAllowed = 'copy' } }"
        >
          <div class="showcase-card__thumb">
            <img
              v-if="getThumbSrc(entry)"
              :src="getThumbSrc(entry)!"
              :alt="entry.filename"
              loading="lazy"
              class="showcase-card__img"
            />
            <q-icon
              v-else
              :name="getTypeIcon(entry.asset_type)"
              size="32px"
              color="grey-5"
            />
            <span
              class="showcase-card__badge"
              :class="`showcase-card__badge--${entry.asset_type.toLowerCase()}`"
            >
              {{ entry.asset_type }}
            </span>
          </div>
          <div class="showcase-card__name" :title="entry.filename">
            {{ entry.filename }}
          </div>
        </div>
      </div>

      <div v-if="filteredEntries.length === 0" class="showcase-section__empty">
        {{ t.noAssetsFound || '没有找到资产' }}
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

.showcase-section {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__header-actions {
    display: flex;
    gap: 2px;
  }

  &__title {
    font-size: 11px;
    font-weight: 600;
    color: $color-secondary;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  &__loading {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: $color-secondary;
    padding: 8px 0;
  }

  &__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__count {
    font-size: 11px;
    color: $color-secondary;
  }

  &__empty {
    text-align: center;
    padding: 24px 0;
    font-size: 12px;
    color: $color-secondary;
  }
}

.showcase-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border: 1px solid $color-border;
  border-radius: 14px;
  background: transparent;
  font-size: 11px;
  color: $color-secondary;
  cursor: pointer;
  transition: $transition-fast;
  font-family: $font-family;

  &:hover {
    border-color: $apple-blue;
    color: $apple-blue;
  }

  &--active {
    background: $apple-blue;
    border-color: $apple-blue;
    color: white;
  }

  &__count {
    font-size: 10px;
    opacity: 0.7;
  }
}

.showcase-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 480px;
  overflow-y: auto;
  padding: 2px;
  align-content: flex-start;
}

.showcase-card {
  width: calc(50% - 4px);
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid $color-border;
  overflow: hidden;
  transition: $transition-fast;

  &:hover {
    border-color: $apple-blue;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  &__thumb {
    position: relative;
    width: 100%;
    height: 120px;
    background: $color-divider;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  &__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &__badge {
    position: absolute;
    top: 4px;
    left: 4px;
    font-size: 8px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    backdrop-filter: blur(4px);

    &--prefab { background: rgba(230, 81, 0, 0.8); }
    &--texture { background: rgba(21, 101, 192, 0.8); }
    &--script { background: rgba(0, 105, 92, 0.8); }
  }

  &__name {
    padding: 6px 8px;
    font-size: 11px;
    font-weight: 500;
    color: $color-text;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
