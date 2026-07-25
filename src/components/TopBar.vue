<script setup lang="ts">
import { useAssetStore } from '../stores/assetStore'
import { useI18n } from '../services/i18n'
import { useModelPreviewBatch } from '../composables/useModelPreviewBatch'
import ModelFilterMenus from './topbar/ModelFilterMenus.vue'
import ModelPreviewBatchDialog from './topbar/ModelPreviewBatchDialog.vue'
import TopBarSearch from './topbar/TopBarSearch.vue'
import ViewOptions from './topbar/ViewOptions.vue'

const emit = defineEmits<{ 'open-settings': [] }>()
const assets = useAssetStore()
const preview = useModelPreviewBatch()
const { t } = useI18n()
</script>

<template>
  <header class="topbar" data-tauri-drag-region>
    <div class="topbar__title" data-tauri-drag-region>{{ t.appTitle }}</div>
    <div class="topbar__search"><TopBarSearch /></div>
    <div class="topbar__actions">
      <span v-if="preview.progress.value && preview.running.value" class="topbar__progress">
        {{ preview.progress.value.completed }}/{{ preview.progress.value.total }}
      </span>
      <q-btn v-if="preview.running.value" flat dense round icon="stop_circle" size="sm" color="negative" :title="t.cancel" @click="preview.cancel" />
      <template v-if="assets.activeAssetKind === 'model'">
        <q-btn flat dense round icon="add_photo_alternate" size="sm" color="grey-7" :loading="preview.running.value" :title="t.generateModelCovers" @click="preview.open" />
        <ModelFilterMenus />
      </template>
      <ViewOptions />
      <q-btn flat dense round icon="refresh" size="sm" color="grey-7" :loading="assets.isScanning" :title="t.refresh" @click="assets.scan" />
      <q-btn flat dense round icon="settings" size="sm" color="grey-7" :title="t.settings" @click="emit('open-settings')" />
    </div>

    <ModelPreviewBatchDialog
      v-model:open="preview.dialogOpen.value"
      v-model:limit="preview.limit.value"
      v-model:current-view-only="preview.currentViewOnly.value"
      :max="preview.candidates.value.length"
      :missing="preview.missing.value.length"
      :current-view="preview.currentView.value.length"
      @start="preview.start"
    />
  </header>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;
.topbar { height: $topbar-height; display: flex; align-items: center; gap: 16px; padding: 0 16px; border-bottom: 1px solid $color-border; background: $glass-background; backdrop-filter: $glass-blur; -webkit-app-region: drag; }
.topbar__title { min-width: 140px; color: $color-text; font-size: 15px; font-weight: 700; white-space: nowrap; }
.topbar__search { flex: 1; max-width: 400px; -webkit-app-region: no-drag; }
.topbar__actions { display: flex; align-items: center; gap: 4px; margin-left: auto; -webkit-app-region: no-drag; }
.topbar__progress { min-width: 48px; color: $color-secondary; font-size: 11px; text-align: right; }
</style>
