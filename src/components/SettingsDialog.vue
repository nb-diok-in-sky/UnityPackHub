<script setup lang="ts">
import { useI18n } from '../services/i18n'
import GeneralSettings from './settings/GeneralSettings.vue'
import LibrarySettings from './settings/LibrarySettings.vue'
import QuickLinkSettings from './settings/QuickLinkSettings.vue'
import ShaderAdapterSettings from './settings/ShaderAdapterSettings.vue'
import UnityEditorSettings from './settings/UnityEditorSettings.vue'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const { t } = useI18n()
</script>

<template>
  <q-dialog :model-value="modelValue" position="right" full-height @update:model-value="emit('update:modelValue', $event)">
    <q-card class="settings-panel">
      <q-card-section class="settings-panel__header">
        <div class="text-h6">{{ t.settings }}</div>
        <q-btn v-close-popup flat round dense icon="close" />
      </q-card-section>

      <q-card-section>
        <GeneralSettings />
        <q-separator class="q-my-lg" />
        <LibrarySettings />
        <q-separator class="q-my-lg" />
        <ShaderAdapterSettings />
        <q-separator class="q-my-lg" />
        <UnityEditorSettings />
        <q-separator class="q-my-lg" />
        <QuickLinkSettings />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.settings-panel { width: 380px; height: 100%; border-radius: 0; }
.settings-panel__header { display: flex; align-items: center; justify-content: space-between; }
</style>
