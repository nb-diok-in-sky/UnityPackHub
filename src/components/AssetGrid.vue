<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Asset } from '../types/asset'
import { CARD_SIZE_MAP } from '../domain/settings'
import { useBrowseStore } from '../stores/browseStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useUnityProjectStore } from '../stores/unityProjectStore'
import { useI18n } from '../i18n'
import { fileService } from '../services/fileService'
import AssetCard from './AssetCard.vue'

const CARD_GAP = 16
const CARD_BODY_HEIGHT = 92
const OVERSCAN_ROWS = 3

const emit = defineEmits<{ 'select-asset': [asset: Asset] }>()
const browse = useBrowseStore()
const library = useLibraryStore()
const settingsStore = useSettingsStore()
const projectStore = useUnityProjectStore()
const { t, tr } = useI18n()

async function addDirectory(): Promise<void> {
  const selected = await fileService.pickDirectory()
  if (selected) await library.addDirectory(selected)
}
const scrollElement = ref<HTMLElement | null>(null)
const viewportWidth = ref(0)
const viewportHeight = ref(0)
const scrollTop = ref(0)

const cardWidth = computed(() => CARD_SIZE_MAP[settingsStore.settings.cardSize])
const cardHeight = computed(() => Math.ceil(cardWidth.value * 0.75) + CARD_BODY_HEIGHT)
const rowHeight = computed(() => cardHeight.value + CARD_GAP)
const columnCount = computed(() => Math.max(1, Math.floor((viewportWidth.value + CARD_GAP) / (cardWidth.value + CARD_GAP))))
const rowCount = computed(() => Math.ceil(browse.visibleAssets.length / columnCount.value))
const firstRow = computed(() => Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - OVERSCAN_ROWS))
const visibleRowCount = computed(() => Math.ceil(viewportHeight.value / rowHeight.value) + OVERSCAN_ROWS * 2)
const lastRow = computed(() => Math.min(rowCount.value, firstRow.value + visibleRowCount.value))
const windowAssets = computed(() => browse.visibleAssets.slice(firstRow.value * columnCount.value, lastRow.value * columnCount.value))
const topSpacer = computed(() => firstRow.value * rowHeight.value)
const bottomSpacer = computed(() => Math.max(0, (rowCount.value - lastRow.value) * rowHeight.value))

let resizeObserver: ResizeObserver | null = null

function updateViewport(): void {
  const element = scrollElement.value
  if (!element) return
  // clientWidth includes the grid padding; columns must fit in the content box or cards overflow.
  const style = getComputedStyle(element)
  viewportWidth.value = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  viewportHeight.value = element.clientHeight
  scrollTop.value = element.scrollTop
}

function handleScroll(): void {
  scrollTop.value = scrollElement.value?.scrollTop ?? 0
}

watch([
  () => browse.search,
  () => browse.favoritesOnly,
  () => browse.kind,
  () => browse.modelCover,
  () => browse.activeTagId,
  () => browse.activeGroupId,
  () => projectStore.filter,
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
    <div v-if="library.isScanning" class="asset-grid__state">
      <q-spinner-dots color="primary" size="40px" />
      <span>{{ t.scanning }}</span>
      <span v-if="library.scanProgress" class="asset-grid__hint">
        {{ tr('scanProgress', { visited: library.scanProgress.visited, found: library.scanProgress.found }) }}
      </span>
    </div>
    <div v-else-if="settingsStore.settings.scanDirectories.length === 0" class="asset-grid__state">
      <q-icon name="create_new_folder" size="64px" color="grey-4" />
      <p>{{ t.welcomeTitle }}</p>
      <span class="asset-grid__hint">{{ t.welcomeHint }}</span>
      <q-btn unelevated no-caps color="primary" icon="add" :label="t.addDirectory" @click="addDirectory" />
    </div>
    <div v-else-if="browse.kindAssets.length === 0" class="asset-grid__state">
      <q-icon name="inventory_2" size="64px" color="grey-4" />
      <p>{{ browse.kind === 'model' ? t.noModelsFound : t.noPackagesFound }}</p>
      <q-btn outline no-caps color="primary" icon="refresh" :label="t.rescan" @click="library.scan" />
    </div>
    <div v-else-if="browse.visibleAssets.length === 0" class="asset-grid__state">
      <q-icon name="filter_alt_off" size="64px" color="grey-4" />
      <p>{{ t.noAssetsMatch }}</p>
      <q-btn outline no-caps color="primary" icon="clear_all" :label="t.clearFilters" @click="browse.resetFilters" />
    </div>
    <div v-else class="asset-grid__virtual">
      <div :style="{ height: `${topSpacer}px` }" />
      <div class="asset-grid__container" :style="{ gridTemplateColumns: `repeat(${columnCount}, ${cardWidth}px)` }">
        <AssetCard
          v-for="asset in windowAssets"
          :key="asset.id"
          :asset="asset"
          :width="cardWidth"
          :height="cardHeight"
          @open="emit('select-asset', $event)"
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
  &__state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 16px; color: $color-secondary; font-size: 15px; p { margin: 0; } }
  &__hint { font-size: 12px; opacity: 0.8; }
}
</style>
