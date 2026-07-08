<script setup lang="ts">
import { computed } from 'vue'
import type { Asset } from '../types/asset'
import { useTagStore } from '../stores/tagStore'
import { useAssetStore } from '../stores/assetStore'
import { useGroupStore } from '../stores/groupStore'
import { useThumbnailStore } from '../stores/thumbnailStore'
import { useI18n } from '../services/i18n'
import { importToUnity, openFileLocation } from '../services/unityImporter'
import { formatBytes } from '../utils/formatBytes'
import TagPill from './TagPill.vue'

const props = defineProps<{
  asset: Asset
  width: number
}>()

const emit = defineEmits<{
  click: [asset: Asset]
  'update:favorite': [id: string]
}>()

const tagStore = useTagStore()
const assetStore = useAssetStore()
const groupStore = useGroupStore()
const thumbnailStore = useThumbnailStore()
const { t } = useI18n()

const isSelected = computed(() => assetStore.selectedIds.has(props.asset.id))

const coverSrc = computed(() => {
  const blobUrl = thumbnailStore.getUrl(props.asset.id)
  if (blobUrl) return blobUrl
  const tp = props.asset.thumbnailPath
  if (tp && tp.startsWith('data:')) return tp
  return ''
})

const assetTags = computed(() =>
  props.asset.tagIds
    .map((id) => tagStore.getTagById(id))
    .filter((t): t is NonNullable<typeof t> => t !== undefined)
)

const fileSizeDisplay = computed(() => formatBytes(props.asset.fileSize))

const initials = computed(() => {
  const name = props.asset.name.trim()
  return name.charAt(0).toUpperCase()
})

function handleClick(event: MouseEvent): void {
  if (assetStore.paintingTagId) {
    assetStore.paintTag(props.asset.id)
    return
  }
  if (event.shiftKey) {
    assetStore.rangeSelect(props.asset.id)
  } else if (event.ctrlKey || event.metaKey) {
    assetStore.toggleSelection(props.asset.id)
  } else {
    emit('click', props.asset)
  }
}

function handleFavorite(event: MouseEvent): void {
  event.stopPropagation()
  emit('update:favorite', props.asset.id)
}

async function handleDoubleClick(): Promise<void> {
  await importToUnity(props.asset.filePath)
}

async function handleOpenLocation(): Promise<void> {
  await openFileLocation(props.asset.filePath)
}

</script>

<template>
  <div
    class="asset-card"
    :class="{ 'asset-card--selected': isSelected, 'asset-card--painting': !!assetStore.paintingTagId }"
    :style="{ width: `${width}px` }"
    @click="handleClick"
    @dblclick.prevent="handleDoubleClick"
  >
    <div class="asset-card__cover">
      <img
        v-if="coverSrc"
        :src="coverSrc"
        :alt="asset.name"
        class="asset-card__image"
      />
      <div v-else class="asset-card__placeholder">
        <span class="asset-card__initial">{{ initials }}</span>
      </div>

      <button class="asset-card__favorite" @click="handleFavorite">
        <q-icon
          :name="asset.isFavorite ? 'star' : 'star_border'"
          :color="asset.isFavorite ? 'amber' : 'grey-5'"
          size="18px"
        />
      </button>
    </div>

    <q-menu context-menu>
      <q-list dense>
        <q-item clickable v-close-popup @click="handleDoubleClick">
          <q-item-section side><q-icon name="download" size="16px" /></q-item-section>
          <q-item-section>{{ t.importToUnity }}</q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="handleOpenLocation">
          <q-item-section side><q-icon name="folder_open" size="16px" /></q-item-section>
          <q-item-section>{{ t.openFileLocation }}</q-item-section>
        </q-item>
        <q-separator />
        <q-item clickable v-close-popup @click="emit('update:favorite', asset.id)">
          <q-item-section side>
            <q-icon :name="asset.isFavorite ? 'star_border' : 'star'" size="16px" />
          </q-item-section>
          <q-item-section>{{ asset.isFavorite ? t.unfavorite : t.favorite }}</q-item-section>
        </q-item>
        <q-separator v-if="groupStore.groups.length > 0" />
        <q-item v-if="groupStore.groups.length > 0" clickable>
          <q-item-section side><q-icon name="create_new_folder" size="16px" /></q-item-section>
          <q-item-section>{{ t.addToGroup }}</q-item-section>
          <q-item-section side><q-icon name="chevron_right" size="16px" /></q-item-section>
          <q-menu anchor="top end" self="top start">
            <q-list dense>
              <q-item
                v-for="group in groupStore.groups"
                :key="group.id"
                clickable
                v-close-popup
                @click="groupStore.addAsset(group.id, asset.id)"
              >
                <q-item-section side><q-icon :name="group.icon" size="16px" /></q-item-section>
                <q-item-section>{{ group.name }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-item>
      </q-list>
    </q-menu>

    <div class="asset-card__body">
      <div class="asset-card__header">
        <span class="asset-card__name" :title="asset.name">
          {{ asset.name }}
        </span>
      </div>

      <p v-if="asset.notes" class="asset-card__notes" :title="asset.notes">
        {{ asset.notes }}
      </p>

      <div class="asset-card__footer">
        <div v-if="assetTags.length > 0" class="asset-card__tags">
          <TagPill
            v-for="tag in assetTags.slice(0, 3)"
            :key="tag.id"
            :tag="tag"
            small
          />
          <span v-if="assetTags.length > 3" class="asset-card__tag-more">
            +{{ assetTags.length - 3 }}
          </span>
        </div>
        <span class="asset-card__size">{{ fileSizeDisplay }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.asset-card {
  background: $color-surface;
  border-radius: $radius-card;
  box-shadow: $shadow-card;
  overflow: hidden;
  cursor: pointer;
  transition: $transition-default;
  position: relative;

  &:hover {
    box-shadow: $shadow-card-hover;
    transform: translateY(-2px);
  }

  &--selected {
    outline: 2px solid $apple-blue;
    outline-offset: -2px;
  }

  &--painting {
    cursor: crosshair;
  }

  &__cover {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: $color-divider;
  }

  &__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: $transition-slow;

    .asset-card:hover & {
      transform: scale(1.02);
    }
  }

  &__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--placeholder-gradient);
  }

  &__initial {
    font-size: 36px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
    text-transform: uppercase;
  }

  &__favorite {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(255, 255, 255, 0.85);
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: $transition-fast;
    backdrop-filter: $glass-blur;

    .asset-card:hover & {
      opacity: 1;
    }

    &:hover {
      background: rgba(255, 255, 255, 1);
    }
  }

  &__body {
    padding: 12px 14px 14px;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  &__name {
    font-size: $font-size-card-name;
    font-weight: $font-weight-card-name;
    color: $color-text;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  &__notes {
    font-size: $font-size-notes;
    color: $color-secondary;
    line-height: 1.4;
    margin: 0 0 8px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__footer {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
    overflow: hidden;
  }

  &__tag-more {
    font-size: 10px;
    color: $color-secondary;
    align-self: center;
  }

  &__size {
    font-size: 11px;
    color: $color-secondary;
    white-space: nowrap;
    flex-shrink: 0;
  }
}
</style>
