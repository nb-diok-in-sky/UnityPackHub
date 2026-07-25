<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Asset } from '../types/asset'
import { CARD_SIZE_MAP } from '../types/asset'
import { useAssetStore } from '../stores/assetStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n } from '../services/i18n'
import AssetCard from './AssetCard.vue'

const CARD_GAP = 16
const CARD_BODY_HEIGHT = 92
const OVERSCAN_ROWS = 3

const emit = defineEmits<{ 'select-asset': [asset: Asset] }>()
const assetStore = useAssetStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()
const scrollElement = ref<HTMLElement | null>(null)
const viewportWidth = ref(0)
const viewportHeight = ref(0)
const scrollTop = ref(0)

const cardWidth = computed(() => CARD_SIZE_MAP[settingsStore.settings.cardSize])
const cardHeight = computed(() => Math.ceil(cardWidth.value * 0.75) + CARD_BODY_HEIGHT)
const rowHeight = computed(() => cardHeight.value + CARD_GAP)
const columnCount = computed(() => Math.max(1, Math.floor((viewportWidth.value + CARD_GAP) / (cardWidth.value + CARD_GAP))))
const rowCount = computed(() => Math.ceil(assetStore.filteredAssets.length / columnCount.value))
const firstRow = computed(() => Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - OVERSCAN_ROWS))
const visibleRowCount = computed(() => Math.ceil(viewportHeight.value / rowHeight.value) + OVERSCAN_ROWS * 2)
const lastRow = computed(() => Math.min(rowCount.value, firstRow.value + visibleRowCount.value))
const visibleAssets = computed(() => assetStore.filteredAssets.slice(firstRow.value * columnCount.value, lastRow.value * columnCount.value))
const topSpacer = computed(() => firstRow.value * rowHeight.value)
const bottomSpacer = computed(() => Math.max(0, (rowCount.value - lastRow.value) * rowHeight.value))

let resizeObserver: ResizeObserver | null = null

function updateViewport(): void {
  const element = scrollElement.value
  if (!element) return
  viewportWidth.value = element.clientWidth
  viewportHeight.value = element.clientHeight
  scrollTop.value = element.scrollTop
}

function handleScroll(): void {
  scrollTop.value = scrollElement.value?.scrollTop ?? 0
}

watch([
  () => assetStore.searchQuery,
  () => assetStore.showFavoritesOnly,
  () => assetStore.activeAssetKind,
  () => assetStore.modelCoverFilter,
  () => settingsStore.settings.cardSize,
], async () => {
  await nextTick()
  scrollElement.value?.scrollTo({ top: 0 })
  updateViewport()
})

onMounted(() => {
  resizeObserver = new ResizeObserver(updateViewport)
  if (scrollElement.value) resizeObserver.observe(scrollElement.value)
  updateViewport()
})

onUnmounted(() => resizeObserver?.disconnect())
</script>

<template>
  <div ref="scrollElement" class="asset-grid" @scroll.passive="handleScroll">
    <div v-if="assetStore.isScanning" class="asset-grid__state">
      <q-spinner-dots color="primary" size="40px" />
      <span>{{ t.scanning }}</span>
    </div>
    <div v-else-if="assetStore.filteredAssets.length === 0" class="asset-grid__state">
      <q-icon name="inventory_2" size="64px" color="grey-4" />
      <p>{{ assetStore.totalCount === 0 ? t.noAssetsYet : t.noAssetsMatch }}</p>
    </div>
    <div v-else class="asset-grid__virtual">
      <div :style="{ height: `${topSpacer}px` }" />
      <div class="asset-grid__container" :style="{ gridTemplateColumns: `repeat(${columnCount}, ${cardWidth}px)` }">
        <AssetCard
          v-for="asset in visibleAssets"
          :key="asset.id"
          :asset="asset"
          :width="cardWidth"
          :height="cardHeight"
          @click="emit('select-asset', $event)"
          @update:favorite="assetStore.toggleFavorite"
        />
      </div>
      <div :style="{ height: `${bottomSpacer}px` }" />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.asset-grid {
  flex: 1;
  overflow-y: auto;
  padding: $spacing-padding;
  background: $color-background;

  &__virtual { min-height: 100%; }
  &__container { display: grid; gap: $spacing-card-gap; align-items: start; }
  &__state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px; color: $color-secondary; font-size: 15px; }
}
</style>
