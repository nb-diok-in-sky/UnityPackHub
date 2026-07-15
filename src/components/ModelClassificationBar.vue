<script setup lang="ts">
import { computed } from 'vue'
import { useAssetStore } from '../stores/assetStore'
import { useGroupStore } from '../stores/groupStore'
import { useTagStore } from '../stores/tagStore'
import { useI18n } from '../services/i18n'

const assetStore = useAssetStore()
const groupStore = useGroupStore()
const tagStore = useTagStore()
const { t } = useI18n()

const classifications = computed(() =>
  groupStore.groups.filter((group) =>
    group.source === 'classification' && group.assetKind === 'model'
  )
)

function selectClassification(id: string | null): void {
  assetStore.setFavoritesOnly(false)
  tagStore.setActiveTag(null)
  groupStore.setActiveGroup(id)
}
</script>

<template>
  <div v-if="assetStore.activeAssetKind === 'model'" class="classification-bar">
    <span class="classification-bar__label">{{ t.modelClassifications }}</span>
    <div v-if="classifications.length > 0" class="classification-bar__items">
      <button
        class="classification-bar__chip"
        :class="{ 'classification-bar__chip--active': !groupStore.activeGroupId }"
        @click="selectClassification(null)"
      >
        {{ t.allClassifications }}
        <span>{{ assetStore.modelCount }}</span>
      </button>
      <button
        v-for="classification in classifications"
        :key="classification.id"
        class="classification-bar__chip"
        :class="{ 'classification-bar__chip--active': groupStore.activeGroupId === classification.id }"
        @click="selectClassification(classification.id)"
      >
        {{ classification.name }}
        <span>{{ classification.assetIds.length }}</span>
      </button>
    </div>
    <div v-else class="classification-bar__empty">{{ t.noClassificationTable }}</div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.classification-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 6px 16px;
  border-bottom: 1px solid $color-border;
  background: $color-surface;

  &__label {
    flex-shrink: 0;
    color: $color-secondary;
    font-size: 11px;
    font-weight: 600;
  }

  &__items {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  &__chip {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    padding: 5px 9px;
    border: 1px solid $color-border;
    border-radius: $radius-tag;
    background: transparent;
    color: $color-secondary;
    cursor: pointer;
    font-size: 11px;
    transition: $transition-fast;

    span {
      opacity: 0.7;
    }

    &:hover,
    &--active {
      border-color: $apple-blue;
      background: var(--accent-soft);
      color: $apple-blue;
    }
  }

  &__empty {
    color: $color-secondary;
    font-size: 11px;
  }
}
</style>
