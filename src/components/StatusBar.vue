<script setup lang="ts">
import { computed } from 'vue'
import { useAssetStore } from '../stores/assetStore'
import { useBrowseStore } from '../stores/browseStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useI18n } from '../i18n'
import { formatBytes } from '../utils/formatBytes'

const assetStore = useAssetStore()
const browse = useBrowseStore()
const library = useLibraryStore()
const { t, tr } = useI18n()

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
    <button
      v-if="browse.hiddenCount > 0"
      class="statusbar__hidden"
      :title="t.hiddenAssetsHint"
      :disabled="library.isScanning"
      @click="library.scan"
    >
      <q-icon name="visibility_off" size="12px" />
      {{ tr('hiddenAssets', { count: browse.hiddenCount }) }}
    </button>
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

.statusbar__hidden {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 0;
  border: 0;
  background: none;
  color: $color-secondary;
  font-size: inherit;
  cursor: pointer;
  &:hover { color: $apple-blue; }
}

.statusbar__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: $color-secondary;
  opacity: 0.5;
}
</style>
