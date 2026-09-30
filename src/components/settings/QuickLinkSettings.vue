<script setup lang="ts">
import { ref } from 'vue'
import { fileService } from '../../services/fileService'
import { useSettingsStore } from '../../stores/settingsStore'
import { useI18n } from '../../i18n'

const settingsStore = useSettingsStore()
const { t } = useI18n()
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
  <div class="text-subtitle2 q-mb-sm">{{ t.quickLinks }}</div>
  <div v-for="link in settingsStore.settings.quickLinks" :key="link.url" class="quick-link">
    <q-btn
      flat
      dense
      no-caps
      :icon="link.icon || 'link'"
      :label="link.name"
      class="quick-link__button"
      @click="fileService.openUrl(link.url)"
    />
    <q-btn flat round dense icon="close" size="sm" color="grey" @click="settingsStore.removeQuickLink(link.url)" />
  </div>

  <div v-if="isAdding" class="quick-link-form">
    <q-input v-model="name" dense outlined :placeholder="t.quickLinkName" />
    <q-input v-model="url" dense outlined placeholder="https://..." @keydown.enter="addLink" />
    <div class="quick-link-form__actions">
      <q-btn dense flat :label="t.cancel" color="grey" @click="isAdding = false" />
      <q-btn dense unelevated :label="t.add" color="primary" @click="addLink" />
    </div>
  </div>
  <q-btn
    v-else
    outline
    dense
    :label="t.addQuickLink"
    icon="add"
    color="primary"
    class="q-mt-sm"
    @click="isAdding = true"
  />
</template>

<style scoped>
.quick-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 0;
}
.quick-link__button {
  font-size: 13px;
  text-transform: none;
}
.quick-link-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}
.quick-link-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
