<script setup lang="ts">
import { computed } from 'vue'
import { useAssetStore } from '../stores/assetStore'
import { useBrowseStore } from '../stores/browseStore'
import { useI18n } from '../i18n'
import { formatBytes } from '../utils/formatBytes'

const assetStore = useAssetStore()
const browse = useBrowseStore()
const { t } = useI18n()

const totalSizeDisplay = computed(() => formatBytes(browse.totalSize))
</script>

<template>
  <div class="statusbar">
    <span>{{ browse.kindAssets.length }} {{ t.assetsTotal }}</span>
    <span class="statusbar__dot" />
    <span>{{ browse.visibleAssets.length }} {{ t.shown }}</span>
    <span class="statusbar__dot" />
    <span>{{ totalSizeDisplay }}</span>
    <template v-if="browse.kind === 'model'">
      <span class="statusbar__dot" />
      <span>{{ t.modelCoverPending }} {{ browse.statistics.pending }}</span>
      <span class="statusbar__dot" />
      <span>{{ t.modelCoverCompleted }} {{ browse.statistics.completed }}</span>
      <span class="statusbar__dot" />
      <span>{{ t.modelCoverNotNeeded }} {{ browse.statistics['not-needed'] }}</span>
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
