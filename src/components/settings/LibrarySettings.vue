<script setup lang="ts">
import { ref } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { useAssetStore } from '../../stores/assetStore'
import { useGroupStore } from '../../stores/groupStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { classificationService } from '../../services/classificationService'
import { useI18n } from '../../services/i18n'

const settingsStore = useSettingsStore()
const assetStore = useAssetStore()
const groupStore = useGroupStore()
const { t } = useI18n()
const isApplyingClassification = ref(false)

async function addDirectory(): Promise<void> {
  const selected = await open({ directory: true, multiple: false })
  if (typeof selected !== 'string') return
  await settingsStore.addScanDirectory(selected)
  await assetStore.scan()
}

async function chooseClassificationJson(): Promise<void> {
  const selected = await open({
    directory: false,
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (typeof selected !== 'string') return

  isApplyingClassification.value = true
  try {
    await settingsStore.setClassificationJsonPath(selected)
    await assetStore.scan()
  } finally {
    isApplyingClassification.value = false
  }
}

async function clearClassificationJson(): Promise<void> {
  await settingsStore.setClassificationJsonPath('')
  await classificationService.clear()
  await groupStore.load()
}
</script>

<template>
  <div class="text-subtitle2 q-mb-sm">{{ t.scanDirectories }}</div>
  <div v-for="directory in settingsStore.settings.scanDirectories" :key="directory.path" class="settings-row">
    <q-toggle :model-value="directory.enabled" dense @update:model-value="settingsStore.toggleScanDirectory(directory.path)" />
    <span class="settings-path">{{ directory.path }}</span>
    <q-btn flat round dense icon="close" size="sm" color="grey" @click="settingsStore.removeScanDirectory(directory.path)" />
  </div>
  <q-btn outline dense :label="t.addDirectory" icon="add" color="primary" class="q-mt-sm" @click="addDirectory" />

  <q-separator class="q-my-lg" />

  <div class="text-subtitle2 q-mb-sm">{{ t.classificationTable }}</div>
  <div class="text-caption text-grey-7 q-mb-sm">{{ t.classificationTableHint }}</div>
  <q-input
    :model-value="settingsStore.settings.classification.jsonPath"
    dense outlined readonly
    :placeholder="t.classificationTablePlaceholder"
    class="q-mb-sm"
  />
  <div class="row q-gutter-sm">
    <q-btn outline dense :label="t.chooseClassificationTable" icon="table_view" color="primary" :loading="isApplyingClassification" @click="chooseClassificationJson" />
    <q-btn v-if="settingsStore.settings.classification.jsonPath" flat dense :label="t.clearClassificationTable" color="grey" @click="clearClassificationJson" />
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

.settings-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.settings-path { flex: 1; overflow: hidden; color: $color-secondary; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
</style>
