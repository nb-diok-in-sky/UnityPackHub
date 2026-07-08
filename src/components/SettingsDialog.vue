<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n } from '../services/i18n'
import type { AppLocale, AppTheme } from '../types/asset'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { open as openUrl } from '@tauri-apps/plugin-shell'
import { useAssetStore } from '../stores/assetStore'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const settingsStore = useSettingsStore()
const assetStore = useAssetStore()
const { t } = useI18n()

const showAddLink = ref(false)
const newLinkName = ref('')
const newLinkUrl = ref('')

async function addDirectory(): Promise<void> {
  const selected = await openDialog({ directory: true, multiple: false })
  if (selected && typeof selected === 'string') {
    await settingsStore.addScanDirectory(selected)
    await assetStore.scan()
  }
}

async function openQuickLink(url: string): Promise<void> {
  await openUrl(url)
}

async function addQuickLink(): Promise<void> {
  const name = newLinkName.value.trim()
  let url = newLinkUrl.value.trim()
  if (!name || !url) return
  if (!url.startsWith('http')) url = 'https://' + url
  await settingsStore.addQuickLink({ name, url, icon: 'link' })
  newLinkName.value = ''
  newLinkUrl.value = ''
  showAddLink.value = false
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    position="right"
    full-height
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card class="settings-panel">
      <q-card-section class="settings-panel__header">
        <div class="text-h6">{{ t.settings }}</div>
        <q-btn flat round dense icon="close" v-close-popup />
      </q-card-section>

      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">{{ t.language }}</div>
        <q-btn-toggle
          :model-value="settingsStore.settings.locale"
          toggle-color="primary"
          dense
          no-caps
          rounded
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
          dense
          no-caps
          rounded
          :options="[
            { label: t.themeLight, value: 'light' },
            { label: t.themeDark, value: 'dark' },
          ]"
          class="q-mb-lg"
          @update:model-value="settingsStore.setTheme($event as AppTheme)"
        />

        <div class="text-subtitle2 q-mb-sm">{{ t.scanDirectories }}</div>
        <div
          v-for="dir in settingsStore.settings.scanDirectories"
          :key="dir.path"
          class="settings-dir"
        >
          <q-toggle
            :model-value="dir.enabled"
            dense
            @update:model-value="settingsStore.toggleScanDirectory(dir.path)"
          />
          <span class="settings-dir__path">{{ dir.path }}</span>
          <q-btn
            flat round dense
            icon="close"
            size="sm"
            color="grey"
            @click="settingsStore.removeScanDirectory(dir.path)"
          />
        </div>

        <q-btn
          outline
          dense
          :label="t.addDirectory"
          icon="add"
          color="primary"
          class="q-mt-sm"
          @click="addDirectory"
        />

        <q-separator class="q-my-lg" />

        <div class="text-subtitle2 q-mb-sm">素材网站快捷入口</div>
        <div
          v-for="link in settingsStore.settings.quickLinks"
          :key="link.url"
          class="settings-link"
        >
          <q-btn
            flat dense no-caps
            :icon="link.icon || 'link'"
            :label="link.name"
            class="settings-link__btn"
            @click="openQuickLink(link.url)"
          />
          <q-btn
            flat round dense
            icon="close"
            size="sm"
            color="grey"
            @click="settingsStore.removeQuickLink(link.url)"
          />
        </div>

        <div v-if="showAddLink" class="settings-link-form">
          <q-input
            v-model="newLinkName"
            dense outlined
            placeholder="名称"
            class="settings-link-form__input"
          />
          <q-input
            v-model="newLinkUrl"
            dense outlined
            placeholder="https://..."
            class="settings-link-form__input"
            @keydown.enter="addQuickLink"
          />
          <div class="settings-link-form__actions">
            <q-btn dense flat label="取消" color="grey" @click="showAddLink = false" />
            <q-btn dense unelevated label="添加" color="primary" @click="addQuickLink" />
          </div>
        </div>

        <q-btn
          v-if="!showAddLink"
          outline dense
          label="添加网站"
          icon="add"
          color="primary"
          class="q-mt-sm"
          @click="showAddLink = true"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.settings-panel {
  width: 380px;
  border-radius: 0;
  height: 100%;
}

.settings-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings-dir {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.settings-dir__path {
  font-size: 12px;
  color: $color-secondary;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 0;

  &__btn {
    font-size: 13px;
    text-transform: none;
  }
}

.settings-link-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;

  &__input {
    font-size: 13px;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
