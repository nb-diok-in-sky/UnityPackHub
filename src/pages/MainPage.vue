<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import type { Asset } from '../types/asset'
import { useAssetStore } from '../stores/assetStore'
import { useTagStore } from '../stores/tagStore'
import { useGroupStore } from '../stores/groupStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useThumbnailStore } from '../stores/thumbnailStore'
import { commandManager } from '../services/commandManager'
import TopBar from '../components/TopBar.vue'
import SideBar from '../components/SideBar.vue'
import AssetGrid from '../components/AssetGrid.vue'
import StatusBar from '../components/StatusBar.vue'
import AssetDetailDrawer from '../components/AssetDetailDrawer.vue'
import MultiSelectToolbar from '../components/MultiSelectToolbar.vue'
import SettingsDialog from '../components/SettingsDialog.vue'
import ModelClassificationBar from '../components/ModelClassificationBar.vue'

const assetStore = useAssetStore()
const tagStore = useTagStore()
const groupStore = useGroupStore()
const settingsStore = useSettingsStore()
const thumbnailStore = useThumbnailStore()

const showSettings = ref(false)
const selectedAssetId = ref<string | null>(null)

const selectedAsset = computed<Asset | null>(() =>
  selectedAssetId.value
    ? assetStore.assets.find(a => a.id === selectedAssetId.value) ?? null
    : null
)

function handleSelectAsset(asset: Asset): void {
  selectedAssetId.value = asset.id
}

function handleKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
    event.preventDefault()
    if (commandManager.canUndo) {
      commandManager.undo().then(() => assetStore.load())
    }
  }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'Z') {
    event.preventDefault()
    if (commandManager.canRedo) {
      commandManager.redo().then(() => assetStore.load())
    }
  }
  if (event.key === 'Escape') {
    if (assetStore.paintingTagId) {
      assetStore.stopTagPaint()
    } else if (assetStore.isMultiSelect) {
      assetStore.clearSelection()
    } else if (selectedAssetId.value) {
      selectedAssetId.value = null
    }
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
    if (assetStore.filteredAssets.length > 0) {
      event.preventDefault()
      assetStore.selectAll()
    }
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  await settingsStore.load()
  await tagStore.load()
  await groupStore.load()
  await assetStore.load()
  await thumbnailStore.loadAll()

  if (settingsStore.settings.scanDirectories.length > 0) {
    await assetStore.scan()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="main-page">
    <TopBar @open-settings="showSettings = true" />
    <ModelClassificationBar />
    <MultiSelectToolbar />

    <div class="main-page__content">
      <SideBar />
      <AssetGrid @select-asset="handleSelectAsset" />
    </div>

    <StatusBar />

    <AssetDetailDrawer
      :asset="selectedAsset"
      @close="selectedAssetId = null"
    />

    <SettingsDialog v-model="showSettings" />
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.main-page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: $font-family;
  background: $color-background;
}

.main-page__content {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>
