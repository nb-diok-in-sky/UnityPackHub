<script setup lang="ts">
import type { CardSize, SortKey } from '../../types/asset'
import { useSettingsStore } from '../../stores/settingsStore'
import { useI18n } from '../../services/i18n'

const settings = useSettingsStore()
const { t } = useI18n()
const sizes: Array<{ icon: string; value: CardSize }> = [
  { icon: 'view_module', value: 'sm' },
  { icon: 'grid_view', value: 'md' },
  { icon: 'view_comfy', value: 'lg' },
]
const sorts: SortKey[] = ['name', 'createdAt', 'fileSize', 'lastUsedAt']
const sortLabels = { name: 'sortName', createdAt: 'sortDate', fileSize: 'sortSize', lastUsedAt: 'sortLastUsed' } as const

async function setSort(key: SortKey): Promise<void> {
  if (settings.settings.sortBy === key) {
    await settings.setSortOrder(settings.settings.sortOrder === 'asc' ? 'desc' : 'asc')
  } else {
    await settings.setSortBy(key)
  }
}
</script>

<template>
  <div class="view-sizes">
    <q-btn v-for="item in sizes" :key="item.value" flat dense round :icon="item.icon" size="sm" :color="settings.settings.cardSize === item.value ? 'primary' : 'grey-6'" @click="settings.setCardSize(item.value)" />
  </div>
  <q-btn flat dense round icon="sort" size="sm" color="grey-7">
    <q-menu>
      <q-list dense>
        <q-item v-for="key in sorts" :key="key" v-close-popup clickable @click="setSort(key)">
          <q-item-section>{{ t[sortLabels[key]] }}</q-item-section>
          <q-item-section v-if="settings.settings.sortBy === key" side>
            <q-icon :name="settings.settings.sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'" size="14px" color="primary" />
          </q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<style scoped>
.view-sizes { display: flex; align-items: center; padding: 2px; border-radius: 8px; background: var(--hover-overlay); }
</style>
