<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Asset } from '../types/asset'
import { CARD_SIZE_MAP } from '../types/asset'
import { useAssetStore } from '../stores/assetStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n } from '../services/i18n'
import AssetCard from './AssetCard.vue'

const PAGE_SIZE = 60

const emit = defineEmits<{
  'select-asset': [asset: Asset]
}>()

const assetStore = useAssetStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()

const cardWidth = computed(() => CARD_SIZE_MAP[settingsStore.settings.cardSize])
const displayCount = ref(PAGE_SIZE)

const visibleAssets = computed(() =>
  assetStore.filteredAssets.slice(0, displayCount.value)
)

const hasMore = computed(() =>
  displayCount.value < assetStore.filteredAssets.length
)

watch(() => [assetStore.searchQuery, assetStore.showFavoritesOnly], () => {
  displayCount.value = PAGE_SIZE
})

function loadMore(_index: number, done: (stop?: boolean) => void): void {
  displayCount.value += PAGE_SIZE
  done(!hasMore.value)
}

function handleCardClick(asset: Asset): void {
  emit('select-asset', asset)
}

async function handleFavorite(id: string): Promise<void> {
  await assetStore.toggleFavorite(id)
}
</script>

<template>
  <div class="asset-grid">
    <div v-if="assetStore.isScanning" class="asset-grid__loading">
      <q-spinner-dots color="primary" size="40px" />
      <span>{{ t.scanning }}</span>
    </div>

    <div
      v-else-if="assetStore.filteredAssets.length === 0"
      class="asset-grid__empty"
    >
      <q-icon name="inventory_2" size="64px" color="grey-4" />
      <p v-if="assetStore.totalCount === 0">
        {{ t.noAssetsYet }}
      </p>
      <p v-else>{{ t.noAssetsMatch }}</p>
    </div>

    <q-infinite-scroll
      v-else
      :offset="400"
      @load="loadMore"
      class="asset-grid__scroll"
    >
      <div class="asset-grid__container">
        <AssetCard
          v-for="asset in visibleAssets"
          :key="asset.id"
          :asset="asset"
          :width="cardWidth"
          @click="handleCardClick"
          @update:favorite="handleFavorite"
        />
      </div>

      <template #loading>
        <div class="row justify-center q-my-md">
          <q-spinner-dots color="primary" size="30px" />
        </div>
      </template>
    </q-infinite-scroll>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.asset-grid {
  flex: 1;
  overflow-y: auto;
  padding: $spacing-padding;
  background: $color-background;

  &__scroll {
    min-height: 100%;
  }

  &__container {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-card-gap;
    align-content: flex-start;
  }

  &__loading,
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
    color: $color-secondary;
    font-size: 15px;
  }
}
</style>
