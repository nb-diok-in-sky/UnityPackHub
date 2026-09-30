<script setup lang="ts">
import type { ModelCoverFilter, UnityProjectFilter } from '../../types/asset'
import { useBrowseStore } from '../../stores/browseStore'
import { useUnityProjectStore } from '../../stores/unityProjectStore'
import { useI18n, type TranslationKey } from '../../i18n'

const browse = useBrowseStore()
const project = useUnityProjectStore()
const { t } = useI18n()

// Labels are translation keys so they follow a language switch.
const projectFilters: Array<{ value: UnityProjectFilter; label: TranslationKey }> = [
  { value: 'all', label: 'projectFilterAll' },
  { value: 'linked', label: 'projectFilterLinked' },
  { value: 'unlinked', label: 'projectFilterUnlinked' },
  { value: 'missing', label: 'projectFilterMissing' },
  { value: 'ambiguous', label: 'projectFilterAmbiguous' },
  { value: 'in-scene', label: 'projectFilterInScene' },
  { value: 'duplicate', label: 'projectFilterDuplicate' },
]

const coverFilters: Array<{ value: ModelCoverFilter; label: TranslationKey; count: () => number }> = [
  { value: 'all', label: 'modelCoverAll', count: () => browse.statistics.model },
  { value: 'pending', label: 'modelCoverPending', count: () => browse.statistics.pending },
  { value: 'completed', label: 'modelCoverCompleted', count: () => browse.statistics.completed },
  { value: 'failed', label: 'modelCoverFailed', count: () => browse.statistics.failed },
  { value: 'not-needed', label: 'modelCoverNotNeeded', count: () => browse.statistics['not-needed'] },
]
</script>

<template>
  <q-btn-dropdown
    flat
    dense
    icon="filter_alt"
    size="sm"
    color="grey-7"
    :label="`${browse.statistics.pending}`"
    :title="t.modelCoverFilter"
  >
    <q-list dense>
      <q-item
        v-for="item in coverFilters"
        :key="item.value"
        v-close-popup
        clickable
        @click="browse.setModelCover(item.value)"
      >
        <q-item-section>{{ t[item.label] }}</q-item-section>
        <q-item-section side>{{ item.count() }}</q-item-section>
      </q-item>
    </q-list>
  </q-btn-dropdown>

  <q-btn-dropdown
    v-if="project.isSynchronized"
    flat
    dense
    icon="account_tree"
    size="sm"
    color="grey-7"
    :title="t.projectFilter"
  >
    <q-list dense>
      <q-item
        v-for="item in projectFilters"
        :key="item.value"
        v-close-popup
        clickable
        @click="project.setFilter(item.value)"
      >
        <q-item-section>{{ t[item.label] }}</q-item-section>
      </q-item>
    </q-list>
  </q-btn-dropdown>
</template>
