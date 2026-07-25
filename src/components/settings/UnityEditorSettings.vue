<script setup lang="ts">
import { ref } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { useSettingsStore } from '../../stores/settingsStore'
import { useI18n } from '../../services/i18n'
import { commands } from '../../services/tauriCommands'

const settingsStore = useSettingsStore()
const { t } = useI18n()
const detectedEditors = ref<string[]>([])
const isDetecting = ref(false)

async function detectEditors(): Promise<void> {
  isDetecting.value = true
  try {
    detectedEditors.value = await commands.discoverUnityEditors()
    if (!settingsStore.settings.unityEditorPath && detectedEditors.value.length === 1) {
      await settingsStore.setUnityEditorPath(detectedEditors.value[0] ?? '')
    }
  } finally {
    isDetecting.value = false
  }
}

async function chooseEditor(): Promise<void> {
  const selected = await open({
    directory: false,
    multiple: false,
    filters: [{ name: 'Unity Editor', extensions: ['exe'] }],
  })
  if (typeof selected === 'string') await settingsStore.setUnityEditorPath(selected)
}
</script>

<template>
  <div class="text-subtitle2 q-mb-sm">{{ t.unityEditorPath }}</div>
  <q-input :model-value="settingsStore.settings.unityEditorPath" dense outlined readonly :placeholder="t.unityPathHint" class="q-mb-sm" />
  <div class="row q-gutter-sm">
    <q-btn outline dense :label="t.detectUnityEditors" icon="search" color="primary" :loading="isDetecting" @click="detectEditors" />
    <q-btn outline dense :label="t.chooseUnityEditor" icon="folder_open" color="primary" @click="chooseEditor" />
  </div>
  <q-list v-if="detectedEditors.length > 1" dense bordered class="q-mt-sm">
    <q-item v-for="editor in detectedEditors" :key="editor" clickable @click="settingsStore.setUnityEditorPath(editor)">
      <q-item-section class="editor-path">{{ editor }}</q-item-section>
    </q-item>
  </q-list>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;
.editor-path { overflow: hidden; color: $color-secondary; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
</style>
