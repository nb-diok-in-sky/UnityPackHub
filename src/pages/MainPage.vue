<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Asset } from '../types/asset'
import { useAssetStore } from '../stores/assetStore'
import { useAppShell } from '../composables/useAppShell'
import TopBar from '../components/TopBar.vue'
import SideBar from '../components/SideBar.vue'
import AssetGrid from '../components/AssetGrid.vue'
import StatusBar from '../components/StatusBar.vue'
import AssetDetailDrawer from '../components/AssetDetailDrawer.vue'
import MultiSelectToolbar from '../components/MultiSelectToolbar.vue'
import SettingsDialog from '../components/SettingsDialog.vue'
import ModelClassificationBar from '../components/ModelClassificationBar.vue'

const assets = useAssetStore()
const showSettings = ref(false)
const selectedAssetId = ref<string | null>(null)
const selectedAsset = computed<Asset | null>(() =>
  selectedAssetId.value ? (assets.byId.get(selectedAssetId.value) ?? null) : null,
)

useAppShell(() => {
  if (!selectedAssetId.value) return false
  selectedAssetId.value = null
  return true
})
</script>

<template>
  <div class="main-page">
    <TopBar @open-settings="showSettings = true" />
    <ModelClassificationBar />
    <MultiSelectToolbar />

    <div class="main-page__content">
      <SideBar />
      <AssetGrid @select-asset="selectedAssetId = $event.id" />
    </div>

    <StatusBar />

    <AssetDetailDrawer :asset="selectedAsset" @close="selectedAssetId = null" />

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
