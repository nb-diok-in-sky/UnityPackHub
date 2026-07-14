<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CardSize, SortKey } from '../types/asset'
import { useAssetStore } from '../stores/assetStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n } from '../services/i18n'
import { startModelPreviewGeneration, type ModelPreviewProgress } from '../services/modelPreviewService'
import { commands } from '../services/tauriCommands'

const emit = defineEmits<{
  'open-settings': []
}>()

const assetStore = useAssetStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()

const SORT_KEYS: SortKey[] = ['name', 'createdAt', 'fileSize', 'lastUsedAt']
let searchTimer: ReturnType<typeof setTimeout> | null = null
const isGeneratingModelCovers = ref(false)
const modelCoverProgress = ref<ModelPreviewProgress | null>(null)
const showModelCoverDialog = ref(false)
const modelCoverLimit = ref(20)
const missingModelCoverCount = computed(() =>
  assetStore.assets.filter((asset) => asset.assetKind === 'model' && !asset.thumbnailPath).length
)

watch(missingModelCoverCount, (count) => {
  modelCoverLimit.value = Math.min(Math.max(1, modelCoverLimit.value), Math.max(1, count))
}, { immediate: true })

const SORT_LABEL_KEYS = {
  name: 'sortName',
  createdAt: 'sortDate',
  fileSize: 'sortSize',
  lastUsedAt: 'sortLastUsed',
} as const

const SIZE_OPTIONS: { icon: string; value: CardSize }[] = [
  { icon: 'view_module', value: 'sm' },
  { icon: 'grid_view', value: 'md' },
  { icon: 'view_comfy', value: 'lg' },
]

function handleSearch(value: string): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => assetStore.setSearch(value), 200)
}

async function handleSort(key: SortKey): Promise<void> {
  if (settingsStore.settings.sortBy === key) {
    await settingsStore.setSortOrder(
      settingsStore.settings.sortOrder === 'asc' ? 'desc' : 'asc'
    )
  } else {
    await settingsStore.setSortBy(key)
  }
}

async function handleCardSize(size: CardSize): Promise<void> {
  await settingsStore.setCardSize(size)
}

async function handleRefresh(): Promise<void> {
  await assetStore.scan()
}

async function handleGenerateModelCovers(): Promise<void> {
  if (isGeneratingModelCovers.value) return
  let editorPath = settingsStore.settings.unityEditorPath
  if (!editorPath) {
    const editors = await commands.discoverUnityEditors()
    if (editors.length === 0) {
      console.error('[ModelPreview] Unity Editor not found')
      return
    }
    editorPath = editors[0] ?? ''
    if (!editorPath) return
    await settingsStore.setUnityEditorPath(editorPath)
  }
  isGeneratingModelCovers.value = true
  try {
    await startModelPreviewGeneration(editorPath, assetStore.assets, modelCoverLimit.value, (progress) => {
      modelCoverProgress.value = progress
    })
  } finally {
    isGeneratingModelCovers.value = false
  }
}

function openModelCoverDialog(): void {
  if (missingModelCoverCount.value === 0) return
  modelCoverLimit.value = Math.min(20, missingModelCoverCount.value)
  showModelCoverDialog.value = true
}
</script>

<template>
  <div class="topbar" data-tauri-drag-region>
    <div class="topbar__title" data-tauri-drag-region>
      {{ t.appTitle }}
    </div>

    <div class="topbar__search">
      <q-input
        :model-value="assetStore.searchQuery"
        dense
        outlined
        :placeholder="t.search"
        class="topbar__search-input"
        @update:model-value="handleSearch($event as string)"
      >
        <template #prepend>
          <q-icon name="search" size="18px" color="grey-6" />
        </template>
        <template v-if="assetStore.searchQuery" #append>
          <q-icon
            name="close"
            size="16px"
            color="grey-5"
            class="cursor-pointer"
            @click="handleSearch('')"
          />
        </template>
      </q-input>
    </div>

    <div class="topbar__actions">
      <span v-if="modelCoverProgress && isGeneratingModelCovers" class="topbar__model-progress">
        {{ modelCoverProgress.completed }}/{{ modelCoverProgress.total }}
      </span>

      <q-btn
        v-if="assetStore.activeAssetKind === 'model'"
        flat dense round
        icon="add_photo_alternate"
        size="sm"
        color="grey-7"
        :loading="isGeneratingModelCovers"
        :title="t.generateModelCovers"
        @click="openModelCoverDialog"
      />

      <div class="topbar__size-group">
        <q-btn
          v-for="opt in SIZE_OPTIONS"
          :key="opt.value"
          flat
          dense
          round
          :icon="opt.icon"
          size="sm"
          :color="settingsStore.settings.cardSize === opt.value ? 'primary' : 'grey-6'"
          @click="handleCardSize(opt.value)"
        />
      </div>

      <q-btn flat dense round icon="sort" size="sm" color="grey-7">
        <q-menu>
          <q-list dense>
            <q-item
              v-for="key in SORT_KEYS"
              :key="key"
              clickable
              v-close-popup
              @click="handleSort(key)"
            >
              <q-item-section>{{ t[SORT_LABEL_KEYS[key]] }}</q-item-section>
              <q-item-section v-if="settingsStore.settings.sortBy === key" side>
                <q-icon
                  :name="settingsStore.settings.sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'"
                  size="14px"
                  color="primary"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <q-btn
        flat dense round
        icon="refresh"
        size="sm"
        color="grey-7"
        :loading="assetStore.isScanning"
        :title="t.refresh"
        @click="handleRefresh"
      />

      <q-btn
        flat dense round
        icon="settings"
        size="sm"
        color="grey-7"
        :title="t.settings"
        @click="emit('open-settings')"
      />
    </div>

    <q-dialog v-model="showModelCoverDialog">
      <q-card class="model-cover-dialog">
        <q-card-section>
          <div class="text-h6">{{ t.modelCoverBatchTitle }}</div>
          <div class="text-caption text-grey-7">
            {{ t.modelCoverMissing }}：{{ missingModelCoverCount }}
          </div>
        </q-card-section>
        <q-card-section>
          <div class="model-cover-dialog__value">{{ modelCoverLimit }}</div>
          <q-slider
            v-model="modelCoverLimit"
            :min="1"
            :max="Math.max(1, missingModelCoverCount)"
            :step="1"
            label
            color="primary"
          />
          <q-input
            v-model.number="modelCoverLimit"
            type="number"
            dense outlined
            :min="1"
            :max="Math.max(1, missingModelCoverCount)"
            :label="t.modelCoverBatchCount"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t.cancel" color="grey" v-close-popup />
          <q-btn
            unelevated
            :label="t.startGeneration"
            color="primary"
            v-close-popup
            @click="handleGenerateModelCovers"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.topbar {
  height: $topbar-height;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  background: $glass-background;
  backdrop-filter: $glass-blur;
  border-bottom: 1px solid $color-border;
  -webkit-app-region: drag;
}

.topbar__title {
  font-size: 15px;
  font-weight: 700;
  color: $color-text;
  white-space: nowrap;
  -webkit-app-region: drag;
  min-width: 140px;
}

.topbar__search {
  flex: 1;
  max-width: 400px;
  -webkit-app-region: no-drag;
}

.topbar__search-input {
  :deep(.q-field__control) {
    border-radius: $radius-input;
    background: var(--hover-overlay);
    border: none;
    height: 34px;

    &::before {
      border: none;
    }
  }

  :deep(.q-field__native) {
    font-size: 13px;
    padding: 0;
  }
}

.topbar__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  -webkit-app-region: no-drag;
}

.topbar__model-progress {
  min-width: 48px;
  font-size: 11px;
  color: $color-secondary;
  text-align: right;
}

.topbar__size-group {
  display: flex;
  align-items: center;
  background: var(--hover-overlay);
  border-radius: 8px;
  padding: 2px;
}

.model-cover-dialog {
  width: 420px;
  border-radius: $radius-dialog;

  &__value {
    margin-bottom: 4px;
    color: $apple-blue;
    font-size: 28px;
    font-weight: 700;
    text-align: center;
  }
}
</style>
