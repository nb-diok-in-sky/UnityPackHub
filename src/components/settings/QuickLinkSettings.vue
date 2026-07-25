<script setup lang="ts">
import { ref } from 'vue'
import { open } from '@tauri-apps/plugin-shell'
import { useSettingsStore } from '../../stores/settingsStore'

const settingsStore = useSettingsStore()
const isAdding = ref(false)
const name = ref('')
const url = ref('')

async function addLink(): Promise<void> {
  const trimmedName = name.value.trim()
  let normalizedUrl = url.value.trim()
  if (!trimmedName || !normalizedUrl) return
  if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`
  await settingsStore.addQuickLink({ name: trimmedName, url: normalizedUrl, icon: 'link' })
  name.value = ''
  url.value = ''
  isAdding.value = false
}
</script>

<template>
  <div class="text-subtitle2 q-mb-sm">素材网站快捷入口</div>
  <div v-for="link in settingsStore.settings.quickLinks" :key="link.url" class="quick-link">
    <q-btn flat dense no-caps :icon="link.icon || 'link'" :label="link.name" class="quick-link__button" @click="open(link.url)" />
    <q-btn flat round dense icon="close" size="sm" color="grey" @click="settingsStore.removeQuickLink(link.url)" />
  </div>

  <div v-if="isAdding" class="quick-link-form">
    <q-input v-model="name" dense outlined placeholder="名称" />
    <q-input v-model="url" dense outlined placeholder="https://..." @keydown.enter="addLink" />
    <div class="quick-link-form__actions">
      <q-btn dense flat label="取消" color="grey" @click="isAdding = false" />
      <q-btn dense unelevated label="添加" color="primary" @click="addLink" />
    </div>
  </div>
  <q-btn v-else outline dense label="添加网站" icon="add" color="primary" class="q-mt-sm" @click="isAdding = true" />
</template>

<style scoped>
.quick-link { display: flex; align-items: center; justify-content: space-between; padding: 2px 0; }
.quick-link__button { font-size: 13px; text-transform: none; }
.quick-link-form { display: flex; flex-direction: column; gap: 8px; padding: 8px 0; }
.quick-link-form__actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
