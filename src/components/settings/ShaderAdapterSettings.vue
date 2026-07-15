<script setup lang="ts">
import { open, save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { useSettingsStore } from '../../stores/settingsStore'
import { useI18n } from '../../services/i18n'
import { SHADER_ADAPTER_TEMPLATE } from '../../services/shaderAdapterTemplate'

const settingsStore = useSettingsStore()
const { t } = useI18n()

async function chooseRules(): Promise<void> {
  const selected = await open({
    directory: false,
    multiple: false,
    filters: [{ name: 'Shader adapter JSON', extensions: ['json'] }],
  })
  if (selected && typeof selected === 'string') {
    await settingsStore.setShaderAdapterRulesPath(selected)
  }
}

async function exportTemplate(): Promise<void> {
  const selected = await save({
    defaultPath: 'UnityPackHub-shader-adapter-template.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (selected) await writeTextFile(selected, JSON.stringify(SHADER_ADAPTER_TEMPLATE, null, 2))
}
</script>

<template>
  <div class="text-subtitle2 q-mb-sm">{{ t.shaderAdapters }}</div>
  <div class="text-caption text-grey-7 q-mb-sm">{{ t.shaderAdaptersHint }}</div>
  <q-input
    :model-value="settingsStore.settings.shaderAdapters.rulesPath"
    dense outlined readonly
    :placeholder="t.shaderAdaptersAutomatic"
    class="q-mb-sm"
  />
  <div class="row q-gutter-sm">
    <q-btn outline dense icon="auto_fix_high" color="primary" :label="t.importShaderRules" @click="chooseRules" />
    <q-btn outline dense icon="download" color="primary" :label="t.exportAiTemplate" @click="exportTemplate" />
    <q-btn
      v-if="settingsStore.settings.shaderAdapters.rulesPath"
      flat dense color="grey" :label="t.clearClassificationTable"
      @click="settingsStore.setShaderAdapterRulesPath('')"
    />
  </div>
</template>

