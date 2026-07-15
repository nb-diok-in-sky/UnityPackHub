<script setup lang="ts">
import { computed } from 'vue'
import { useAssetStore } from '../stores/assetStore'
import { useI18n } from '../services/i18n'
import { formatBytes } from '../utils/formatBytes'

const assetStore = useAssetStore()
const { t } = useI18n()

const totalSizeDisplay = computed(() => formatBytes(assetStore.totalSize))
</script>

<template>
  <div class="statusbar">
    <span>{{ assetStore.totalCount }} {{ t.assetsTotal }}</span>
    <span class="statusbar__dot" />
    <span>{{ assetStore.filteredCount }} {{ t.shown }}</span>
    <span class="statusbar__dot" />
    <span>{{ totalSizeDisplay }}</span>
    <template v-if="assetStore.activeAssetKind === 'model'">
      <span class="statusbar__dot" />
      <span>{{ t.modelCoverPending }} {{ assetStore.pendingModelCoverCount }}</span>
      <span class="statusbar__dot" />
      <span>{{ t.modelCoverCompleted }} {{ assetStore.completedModelCoverCount }}</span>
      <span class="statusbar__dot" />
      <span>{{ t.modelCoverNotNeeded }} {{ assetStore.ineligibleModelCoverCount }}</span>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.statusbar {
  height: $statusbar-height;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 20px;
  font-size: $font-size-status;
  color: $color-secondary;
  background: $color-surface;
  border-top: 1px solid $color-border;
}

.statusbar__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: $color-secondary;
  opacity: 0.5;
}
</style>
