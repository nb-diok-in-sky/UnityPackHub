<script setup lang="ts">
import type { ModelCoverFilter, UnityProjectFilter } from '../../types/asset'
import { useAssetStore } from '../../stores/assetStore'
import { useUnityProjectStore } from '../../stores/unityProjectStore'
import { useI18n } from '../../services/i18n'

const assets = useAssetStore()
const project = useUnityProjectStore()
const { t } = useI18n()

const projectFilters: Array<{ value: UnityProjectFilter; label: string }> = [
  { value: 'all', label: '全部项目状态' },
  { value: 'linked', label: '项目中已存在' },
  { value: 'unlinked', label: '项目中不存在' },
  { value: 'missing', label: 'GUID 关联失效' },
  { value: 'ambiguous', label: '同名冲突' },
  { value: 'in-scene', label: '当前场景使用' },
  { value: 'duplicate', label: '重复候选' },
]

const coverFilters: Array<{ value: ModelCoverFilter; label: string; count: () => number }> = [
  { value: 'all', label: t.modelCoverAll, count: () => assets.modelCount },
  { value: 'pending', label: t.modelCoverPending, count: () => assets.pendingModelCoverCount },
  { value: 'completed', label: t.modelCoverCompleted, count: () => assets.completedModelCoverCount },
  { value: 'failed', label: t.modelCoverFailed, count: () => assets.failedModelCoverCount },
  { value: 'not-needed', label: t.modelCoverNotNeeded, count: () => assets.ineligibleModelCoverCount },
]
</script>

<template>
  <q-btn-dropdown flat dense icon="filter_alt" size="sm" color="grey-7" :label="`${assets.pendingModelCoverCount}`" :title="t.modelCoverFilter">
    <q-list dense>
      <q-item v-for="item in coverFilters" :key="item.value" v-close-popup clickable @click="assets.setModelCoverFilter(item.value)">
        <q-item-section>{{ item.label }}</q-item-section>
        <q-item-section side>{{ item.count() }}</q-item-section>
      </q-item>
    </q-list>
  </q-btn-dropdown>

  <q-btn-dropdown v-if="project.isSynchronized" flat dense icon="account_tree" size="sm" color="grey-7" title="Unity 项目筛选">
    <q-list dense>
      <q-item v-for="item in projectFilters" :key="item.value" v-close-popup clickable @click="project.setFilter(item.value)">
        <q-item-section>{{ item.label }}</q-item-section>
      </q-item>
    </q-list>
  </q-btn-dropdown>
</template>
