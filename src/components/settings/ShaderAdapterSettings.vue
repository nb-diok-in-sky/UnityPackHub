<script setup lang="ts">
import { fileService, JSON_FILTER } from '../../services/fileService'
import { useSettingsStore } from '../../stores/settingsStore'
import { useI18n } from '../../i18n'
import { SHADER_ADAPTER_TEMPLATE } from '../../domain/shaderAdapterTemplate'

const settingsStore = useSettingsStore()
const { t } = useI18n()

async function chooseRules(): Promise<void> {
  const selected = await fileService.pickFile([JSON_FILTER])
  if (selected) await settingsStore.setShaderAdapterRulesPath(selected)
}

async function exportTemplate(): Promise<void> {
  const selected = await fileService.pickSavePath('UnityPackHub-shader-adapter-template.json', [JSON_FILTER])
  if (selected) await fileService.writeText(selected, JSON.stringify(SHADER_ADAPTER_TEMPLATE, null, 2))
}
</script>

<template>
  <div class="text-subtitle2 q-mb-sm">{{ t.shaderAdapters }}</div>
  <div class="text-caption text-grey-7 q-mb-sm">{{ t.shaderAdaptersHint }}</div>
  <q-input
    :model-value="settingsStore.settings.shaderAdapters.rulesPath"
    dense
    outlined
    readonly
    :placeholder="t.shaderAdaptersAutomatic"
    class="q-mb-sm"
  />
  <div class="row q-gutter-sm">
    <q-btn outline dense icon="auto_fix_high" color="primary" :label="t.importShaderRules" @click="chooseRules" />
    <q-btn outline dense icon="download" color="primary" :label="t.exportAiTemplate" @click="exportTemplate" />
    <q-btn
      v-if="settingsStore.settings.shaderAdapters.rulesPath"
      flat
      dense
      color="grey"
      :label="t.clearClassificationTable"
      @click="settingsStore.setShaderAdapterRulesPath('')"
    />
  </div>
</template>
