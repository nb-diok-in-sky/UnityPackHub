<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Asset } from '../types/asset'
import { useAssetStore } from '../stores/assetStore'
import { useI18n } from '../services/i18n'
import { importToUnity, openFileLocation, detectUnityProject } from '../services/unityImporter'
import { formatBytes } from '../utils/formatBytes'
import ShowcaseSection from './detail/ShowcaseSection.vue'
import ModelShowcaseSection from './detail/ModelShowcaseSection.vue'
import UnityPreviewsSection from './detail/UnityPreviewsSection.vue'
import AssetCoverEditor from './detail/AssetCoverEditor.vue'
import AssetNotesEditor from './detail/AssetNotesEditor.vue'
import AssetTagEditor from './detail/AssetTagEditor.vue'

const props = defineProps<{
  asset: Asset | null
}>()

const emit = defineEmits<{
  close: []
}>()

const assetStore = useAssetStore()
const { t } = useI18n()

const isImporting = ref(false)
const importStatus = ref('')

const showcaseRef = ref<InstanceType<typeof ShowcaseSection> | null>(null)
const modelShowcaseRef = ref<InstanceType<typeof ModelShowcaseSection> | null>(null)
const previewsRef = ref<InstanceType<typeof UnityPreviewsSection> | null>(null)

const isPackage = computed(() => !props.asset || props.asset.assetKind !== 'model')
const isModel = computed(() => props.asset?.assetKind === 'model')

const fileSizeDisplay = computed(() =>
  props.asset ? formatBytes(props.asset.fileSize) : ''
)

const createdDateDisplay = computed(() => {
  if (!props.asset) return ''
  return new Date(props.asset.createdAt).toLocaleDateString('zh-CN')
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
          <AssetCoverEditor :asset="asset" />

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

          <AssetNotesEditor :asset="asset" />
          <AssetTagEditor :asset="asset" />

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
