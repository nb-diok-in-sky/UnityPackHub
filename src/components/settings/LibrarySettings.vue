<script setup lang="ts">
import { ref } from 'vue'
import { fileService, JSON_FILTER } from '../../services/fileService'
import { useLibraryStore } from '../../stores/libraryStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useI18n } from '../../i18n'
import { confirm } from '../../ui/feedback'

const settingsStore = useSettingsStore()
const library = useLibraryStore()
const { t, tr } = useI18n()
const isApplyingClassification = ref(false)

async function addDirectory(): Promise<void> {
  const selected = await fileService.pickDirectory()
  if (selected) await library.addDirectory(selected)
}

async function removeDirectory(path: string): Promise<void> {
  if (await confirm(t.removeDirectoryTitle, tr('removeDirectoryConfirm', { path }))) await library.removeDirectory(path)
}

async function chooseClassificationJson(): Promise<void> {
  const selected = await fileService.pickFile([JSON_FILTER])
  if (!selected) return
  isApplyingClassification.value = true
  try {
    await library.setClassificationTable(selected)
  } finally {
    isApplyingClassification.value = false
  }
}
</script>

<template>
  <div class="text-subtitle2 q-mb-sm">{{ t.scanDirectories }}</div>
  <div v-for="directory in settingsStore.settings.scanDirectories" :key="directory.path" class="settings-row">
    <q-toggle :model-value="directory.enabled" dense @update:model-value="library.toggleDirectory(directory.path)" />
    <span class="settings-path">{{ directory.path }}</span>
    <q-btn flat round dense icon="close" size="sm" color="grey" @click="removeDirectory(directory.path)" />
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
    <q-btn v-if="settingsStore.settings.classification.jsonPath" flat dense :label="t.clearClassificationTable" color="grey" @click="library.setClassificationTable('')" />
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

.settings-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.settings-path { flex: 1; overflow: hidden; color: $color-secondary; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
</style>
