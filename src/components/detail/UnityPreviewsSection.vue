<script setup lang="ts">
import { ref } from 'vue'
import type { Asset } from '../../types/asset'
import type { PreviewEntry } from '../../services/unityImporter'
import { useAssetStore } from '../../stores/assetStore'
import { useI18n } from '../../services/i18n'
import { getPackagePreviews, readPreviewImage } from '../../services/unityImporter'
import type { PackagePreviews } from '../../services/unityImporter'

const props = defineProps<{
  asset: Asset
}>()

const assetStore = useAssetStore()
const { t } = useI18n()

const unityPreviews = ref<PackagePreviews | null>(null)
const isLoadingPreviews = ref(false)
const previewDataUrls = ref<Record<string, string>>({})
const lightboxEntry = ref<PreviewEntry | null>(null)

async function loadPreviews(): Promise<void> {
  isLoadingPreviews.value = true
  try {
    const packageName = props.asset.name.replace(/\.unitypackage$/i, '')
    const previews = await getPackagePreviews(packageName)
    unityPreviews.value = previews
    if (previews) {
      const urls: Record<string, string> = {}
      for (const entry of previews.entries) {
        const dataUrl = await readPreviewImage(previews.preview_dir, entry.preview)
        if (dataUrl) urls[entry.preview] = dataUrl
      }
      previewDataUrls.value = urls
    }
  } finally {
    isLoadingPreviews.value = false
  }
}

async function usePreviewAsCover(previewDir: string, filename: string): Promise<void> {
  const dataUrl = await readPreviewImage(previewDir, filename)
  if (dataUrl) {
    await assetStore.updateAsset(props.asset.id, { thumbnailPath: dataUrl })
  }
}

function openLightbox(entry: PreviewEntry): void {
  lightboxEntry.value = entry
}

function closeLightbox(): void {
  lightboxEntry.value = null
}

function reset(): void {
  unityPreviews.value = null
  previewDataUrls.value = {}
  lightboxEntry.value = null
}

defineExpose({ reset, loadPreviews })
</script>

<template>
  <div v-if="unityPreviews && unityPreviews.entries.length > 0" class="detail-panel__section detail-panel__section--vertical">
    <span class="detail-panel__label">
      {{ t.unityPreviews }}
      <span class="preview-count">{{ unityPreviews.entries.length }}</span>
    </span>

    <div class="preview-grid">
      <div
        v-for="entry in unityPreviews.entries"
        :key="entry.preview"
        class="preview-grid__card"
        :class="{ 'preview-grid__card--rendered': entry.renderType === 'rendered' }"
        :title="`${entry.name} (${entry.type})`"
        @click="openLightbox(entry)"
      >
        <div class="preview-grid__img-wrap">
          <img
            v-if="previewDataUrls[entry.preview]"
            :src="previewDataUrls[entry.preview]"
            :alt="entry.name"
            class="preview-grid__img"
          />
          <q-icon v-else name="view_in_ar" size="40px" color="grey-5" />
          <span v-if="entry.renderType === 'rendered'" class="preview-grid__badge">3D</span>
        </div>
        <div class="preview-grid__info">
          <span class="preview-grid__name" :title="entry.name">{{ entry.name }}</span>
          <span class="preview-grid__type">{{ entry.type }}</span>
        </div>
        <q-btn
          flat dense round
          icon="photo"
          size="xs"
          color="primary"
          class="preview-grid__use-btn"
          :title="t.useAsPreview"
          @click.stop="usePreviewAsCover(unityPreviews!.preview_dir, entry.preview)"
        />
      </div>
    </div>
  </div>

  <div v-else-if="isLoadingPreviews" class="detail-panel__section detail-panel__section--vertical">
    <span class="detail-panel__label">{{ t.unityPreviews }}</span>
    <div class="detail-panel__contents-loading">
      <q-spinner-dots size="20px" color="primary" />
      <span>{{ t.loadingPreviews }}</span>
    </div>
  </div>

  <!-- Lightbox -->
  <Teleport to="body">
    <Transition name="lightbox">
      <div
        v-if="lightboxEntry && previewDataUrls[lightboxEntry.preview]"
        class="lightbox"
        @click.self="closeLightbox"
      >
        <div class="lightbox__content">
          <img
            :src="previewDataUrls[lightboxEntry.preview]"
            :alt="lightboxEntry.name"
            class="lightbox__img"
          />
          <div class="lightbox__footer">
            <div class="lightbox__meta">
              <span class="lightbox__name">{{ lightboxEntry.name }}</span>
              <span class="lightbox__type">
                {{ lightboxEntry.type }}
                <span v-if="lightboxEntry.renderType === 'rendered'" class="lightbox__badge">3D Rendered</span>
              </span>
            </div>
            <div class="lightbox__actions">
              <q-btn
                flat dense no-caps
                icon="photo"
                :label="t.useAsPreview"
                color="primary"
                @click="usePreviewAsCover(unityPreviews!.preview_dir, lightboxEntry!.preview); closeLightbox()"
              />
              <q-btn flat dense round icon="close" color="grey-5" @click="closeLightbox" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

.detail-panel {
  &__section {
    display: flex;
    align-items: center;
    gap: 8px;

    &--vertical {
      flex-direction: column;
      align-items: stretch;
    }
  }

  &__label {
    font-size: 11px;
    font-weight: 600;
    color: $color-secondary;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__contents-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: $color-secondary;
    padding: 8px 0;
  }
}

.preview-count {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 8px;
  background: $color-divider;
  color: $color-secondary;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  max-height: 600px;
  overflow-y: auto;
  padding: 2px;

  &__card {
    position: relative;
    border-radius: 8px;
    border: 1px solid $color-border;
    overflow: hidden;
    cursor: pointer;
    transition: $transition-fast;

    &:hover {
      border-color: $apple-blue;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

      .preview-grid__use-btn {
        opacity: 1;
      }
    }

    &--rendered {
      border-color: rgba(21, 101, 192, 0.3);
    }
  }

  &__img-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    background: #1a1a1a;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  &__badge {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: 9px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(21, 101, 192, 0.85);
    color: white;
    letter-spacing: 0.5px;
    backdrop-filter: blur(4px);
  }

  &__info {
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__name {
    font-size: 11px;
    font-weight: 500;
    color: $color-text;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__type {
    font-size: 10px;
    color: $color-secondary;
  }

  &__use-btn {
    position: absolute;
    top: 4px;
    left: 4px;
    opacity: 0;
    transition: $transition-fast;
    background: rgba(255, 255, 255, 0.85) !important;
    backdrop-filter: blur(4px);
  }
}

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);

  &__content {
    max-width: 80vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    overflow: hidden;
    background: $color-surface;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  }

  &__img {
    max-width: 80vw;
    max-height: 70vh;
    object-fit: contain;
    background: #1a1a1a;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    gap: 12px;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__name {
    font-size: 14px;
    font-weight: 600;
    color: $color-text;
  }

  &__type {
    font-size: 12px;
    color: $color-secondary;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    background: #e3f2fd;
    color: #1565c0;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
}

.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.2s ease;

  .lightbox__content {
    transition: transform 0.2s ease;
  }
}

.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;

  .lightbox__content {
    transform: scale(0.9);
  }
}
</style>
