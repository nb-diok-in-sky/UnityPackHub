<script setup lang="ts">
import { ref, computed } from 'vue'
import { exists } from '@tauri-apps/plugin-fs'
import type { Asset } from '../../types/asset'
import { useI18n } from '../../services/i18n'
import { formatBytes } from '../../utils/formatBytes'
import { commands } from '../../services/tauriCommands'
import type { AssetMetadata, RelatedFile } from '../../services/tauriCommands'

const props = defineProps<{
  asset: Asset
}>()

const { t } = useI18n()

const relatedFiles = ref<RelatedFile[]>([])
const metadata = ref<AssetMetadata | null>(null)
const isLoading = ref(false)
const isOpen = ref(false)
const activeFilter = ref<'all' | 'texture' | 'material' | 'model' | 'prefab'>('all')

const filteredFiles = computed(() => {
  if (activeFilter.value === 'all') return relatedFiles.value
  return relatedFiles.value.filter(f => f.fileType === activeFilter.value)
})

const typeCounts = computed(() => {
  const counts: Record<string, number> = { all: relatedFiles.value.length }
  for (const f of relatedFiles.value) {
    counts[f.fileType] = (counts[f.fileType] || 0) + 1
  }
  return counts
})

function getTypeIcon(type: string): string {
  switch (type) {
    case 'texture': return 'image'
    case 'material': return 'palette'
    case 'prefab': return 'widgets'
    case 'model': return 'view_in_ar'
    default: return 'insert_drive_file'
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'texture': return t.assetTypeTexture
    case 'material': return t.assetTypeMaterial
    case 'prefab': return t.assetTypePrefab
    case 'model': return t.assetTypeModel
    default: return t.assetTypeOther
  }
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx === -1 ? '' : path.slice(0, idx)
}

function joinPath(dir: string, name: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  return `${dir}${sep}${name}`
}

async function tryLoadMetadata(): Promise<void> {
  const dir = dirname(props.asset.filePath)
  if (!dir) return

  for (const name of ['asset_metadata.json', 'metadata.json', 'model_metadata.json']) {
    const jsonPath = joinPath(dir, name)
    try {
      if (!await exists(jsonPath)) continue
      metadata.value = await commands.readAssetMetadata(jsonPath, props.asset.filePath)
      if (metadata.value) return
    } catch (err) {
      console.warn('[ModelShowcase] metadata read failed:', err)
    }
  }
}

async function handleToggle(): Promise<void> {
  if (isOpen.value) {
    isOpen.value = false
    return
  }
  if (relatedFiles.value.length === 0) {
    isLoading.value = true
    try {
      const [files] = await Promise.all([
        commands.scanModelRelatedFiles(props.asset.filePath),
        tryLoadMetadata(),
      ])
      relatedFiles.value = files
    } catch (err) {
      console.error('[ModelShowcase] scan failed:', err)
    } finally {
      isLoading.value = false
    }
  }
  isOpen.value = true
}

async function handleReveal(filePath: string): Promise<void> {
  await commands.revealInExplorer(filePath)
}

function reset(): void {
  relatedFiles.value = []
  metadata.value = null
  isOpen.value = false
  activeFilter.value = 'all'
}

defineExpose({ reset })
</script>

<template>
  <div class="model-showcase">
    <div class="model-showcase__header">
      <span class="model-showcase__title">{{ t.modelShowcase }}</span>
      <div class="model-showcase__header-actions">
        <q-btn
          flat round dense
          :icon="isOpen ? 'expand_less' : 'expand_more'"
          size="xs" color="grey-7"
          :loading="isLoading"
          @click="handleToggle"
        />
      </div>
    </div>

    <div v-if="isLoading" class="model-showcase__loading">
      <q-spinner-dots size="20px" color="primary" />
      <span>{{ t.loadingContents }}</span>
    </div>

    <template v-if="isOpen && !isLoading">
      <div v-if="metadata" class="model-metadata">
        <div class="model-metadata__title">{{ metadata.inferredObject || metadata.originalName }}</div>
        <div class="model-metadata__grid">
          <span>{{ t.assetTypePrefab }}</span>
          <strong>{{ metadata.format || '-' }}</strong>
          <span>{{ t.filePath }}</span>
          <strong :title="metadata.path">{{ metadata.path }}</strong>
          <template v-if="metadata.sourceAsset">
            <span>Source</span>
            <strong :title="metadata.sourceAsset">{{ metadata.sourceAsset }}</strong>
          </template>
          <template v-if="metadata.boundsText">
            <span>Bounds</span>
            <strong>{{ metadata.boundsText }}</strong>
          </template>
        </div>
      </div>

      <div v-if="relatedFiles.length > 0" class="model-showcase__filters">
        <button
          class="showcase-chip"
          :class="{ 'showcase-chip--active': activeFilter === 'all' }"
          @click="activeFilter = 'all'"
        >
          {{ t.assetTypeAll }}
          <span class="showcase-chip__count">{{ typeCounts.all || 0 }}</span>
        </button>
        <button
          v-if="typeCounts.texture"
          class="showcase-chip"
          :class="{ 'showcase-chip--active': activeFilter === 'texture' }"
          @click="activeFilter = 'texture'"
        >
          <q-icon name="image" size="12px" />
          {{ t.assetTypeTexture }}
          <span class="showcase-chip__count">{{ typeCounts.texture }}</span>
        </button>
        <button
          v-if="typeCounts.material"
          class="showcase-chip"
          :class="{ 'showcase-chip--active': activeFilter === 'material' }"
          @click="activeFilter = 'material'"
        >
          <q-icon name="palette" size="12px" />
          {{ t.assetTypeMaterial }}
          <span class="showcase-chip__count">{{ typeCounts.material }}</span>
        </button>
        <button
          v-if="typeCounts.model"
          class="showcase-chip"
          :class="{ 'showcase-chip--active': activeFilter === 'model' }"
          @click="activeFilter = 'model'"
        >
          <q-icon name="view_in_ar" size="12px" />
          {{ t.assetTypeModel }}
          <span class="showcase-chip__count">{{ typeCounts.model }}</span>
        </button>
        <button
          v-if="typeCounts.prefab"
          class="showcase-chip"
          :class="{ 'showcase-chip--active': activeFilter === 'prefab' }"
          @click="activeFilter = 'prefab'"
        >
          <q-icon name="widgets" size="12px" />
          {{ t.assetTypePrefab }}
          <span class="showcase-chip__count">{{ typeCounts.prefab }}</span>
        </button>
      </div>

      <div class="model-showcase__count">
        {{ filteredFiles.length }} / {{ relatedFiles.length }}
      </div>

      <div v-if="filteredFiles.length > 0" class="model-showcase__list">
        <div
          v-for="file in filteredFiles"
          :key="file.filePath"
          class="model-file"
          :title="file.filePath"
          @click="handleReveal(file.filePath)"
        >
          <div class="model-file__icon">
            <q-icon :name="getTypeIcon(file.fileType)" size="24px" color="grey-5" />
          </div>
          <div class="model-file__info">
            <span class="model-file__name">{{ file.fileName }}</span>
            <span class="model-file__meta">
              {{ getTypeLabel(file.fileType) }} · {{ formatBytes(file.fileSize) }}
            </span>
          </div>
          <span
            class="model-file__badge"
            :class="`model-file__badge--${file.fileType}`"
          >
            {{ getTypeLabel(file.fileType) }}
          </span>
        </div>
      </div>

      <div v-else class="model-showcase__empty">
        {{ t.noRelatedFiles }}
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

.model-showcase {
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

  &__list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 400px;
    overflow-y: auto;
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

.model-file {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid $color-border;
  cursor: pointer;
  transition: $transition-fast;

  &:hover {
    border-color: $apple-blue;
    background: var(--hover-overlay-subtle);
  }

  &__icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 6px;
    background: $color-divider;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__name {
    font-size: 12px;
    font-weight: 500;
    color: $color-text;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    font-size: 10px;
    color: $color-secondary;
  }

  &__badge {
    flex-shrink: 0;
    font-size: 8px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.3px;

    &--texture {
      background: rgba(21, 101, 192, 0.15);
      color: rgb(21, 101, 192);
    }

    &--material {
      background: rgba(156, 39, 176, 0.15);
      color: rgb(156, 39, 176);
    }

    &--model {
      background: rgba(239, 108, 0, 0.15);
      color: rgb(239, 108, 0);
    }

    &--prefab {
      background: rgba(46, 125, 50, 0.15);
      color: rgb(46, 125, 50);
    }
  }
}

.model-metadata {
  padding: 10px;
  border: 1px solid $color-border;
  border-radius: 8px;
  background: var(--hover-overlay-subtle);

  &__title {
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
    color: $color-text;
  }

  &__grid {
    display: grid;
    grid-template-columns: 70px 1fr;
    gap: 5px 10px;
    font-size: 11px;

    span {
      color: $color-secondary;
    }

    strong {
      min-width: 0;
      color: $color-text;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>
