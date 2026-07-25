<script setup lang="ts">
import { useSettingsStore } from '../../stores/settingsStore'
import { useI18n } from '../../services/i18n'
import type { AppLocale, AppTheme } from '../../types/asset'

const settingsStore = useSettingsStore()
const { t } = useI18n()
</script>

<template>
  <div class="text-subtitle2 q-mb-sm">{{ t.language }}</div>
  <q-btn-toggle
    :model-value="settingsStore.settings.locale"
    toggle-color="primary"
    dense no-caps rounded
    :options="[
      { label: '中文', value: 'zh-CN' },
      { label: 'English', value: 'en-US' },
    ]"
    class="q-mb-lg"
    @update:model-value="settingsStore.setAppLocale($event as AppLocale)"
  />

  <div class="text-subtitle2 q-mb-sm">{{ t.theme }}</div>
  <q-btn-toggle
    :model-value="settingsStore.settings.theme"
    toggle-color="primary"
    dense no-caps rounded
    :options="[
      { label: t.themeLight, value: 'light' },
      { label: t.themeDark, value: 'dark' },
    ]"
    @update:model-value="settingsStore.setTheme($event as AppTheme)"
  />
</template>
