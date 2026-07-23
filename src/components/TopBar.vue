<script setup lang="ts">
import type {
  CardSize,
  ModelCoverFilter,
  SortKey,
  UnityProjectFilter,
} from "../types/asset";
import { useAssetStore } from "../stores/assetStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useUnityProjectStore } from "../stores/unityProjectStore";
import { useI18n } from "../services/i18n";
import { useModelPreviewBatch } from "../composables/useModelPreviewBatch";
import TopBarSearch from "./topbar/TopBarSearch.vue";
import ModelPreviewBatchDialog from "./topbar/ModelPreviewBatchDialog.vue";

const emit = defineEmits<{ "open-settings": [] }>();
const assets = useAssetStore();
const settings = useSettingsStore();
const project = useUnityProjectStore();
const preview = useModelPreviewBatch();
const { t } = useI18n();
const sizes: Array<{ icon: string; value: CardSize }> = [
  { icon: "view_module", value: "sm" },
  { icon: "grid_view", value: "md" },
  { icon: "view_comfy", value: "lg" },
];
const sorts: SortKey[] = ["name", "createdAt", "fileSize", "lastUsedAt"];
const sortLabels = {
  name: "sortName",
  createdAt: "sortDate",
  fileSize: "sortSize",
  lastUsedAt: "sortLastUsed",
} as const;
const projectFilters: Array<{ value: UnityProjectFilter; label: string }> = [
  { value: "all", label: "全部项目状态" },
  { value: "linked", label: "项目中已存在" },
  { value: "unlinked", label: "项目中不存在" },
  { value: "missing", label: "GUID 关联失效" },
  { value: "ambiguous", label: "同名冲突" },
  { value: "in-scene", label: "当前场景使用" },
  { value: "duplicate", label: "重复候选" },
];
const coverFilters: Array<{
  value: ModelCoverFilter;
  label: string;
  count: () => number;
}> = [
  { value: "all", label: t.modelCoverAll, count: () => assets.modelCount },
  {
    value: "pending",
    label: t.modelCoverPending,
    count: () => assets.pendingModelCoverCount,
  },
  {
    value: "completed",
    label: t.modelCoverCompleted,
    count: () => assets.completedModelCoverCount,
  },
  {
    value: "failed",
    label: t.modelCoverFailed,
    count: () => assets.failedModelCoverCount,
  },
  {
    value: "not-needed",
    label: t.modelCoverNotNeeded,
    count: () => assets.ineligibleModelCoverCount,
  },
];
async function sort(key: SortKey) {
  if (settings.settings.sortBy === key)
    await settings.setSortOrder(
      settings.settings.sortOrder === "asc" ? "desc" : "asc",
    );
  else await settings.setSortBy(key);
}
</script>

<template>
  <header class="topbar" data-tauri-drag-region>
    <div class="topbar__title" data-tauri-drag-region>{{ t.appTitle }}</div>
    <div class="topbar__search"><TopBarSearch /></div>
    <div class="topbar__actions">
      <span
        v-if="preview.progress.value && preview.running.value"
        class="topbar__progress"
        >{{ preview.progress.value.completed }}/{{
          preview.progress.value.total
        }}</span
      >
      <q-btn
        v-if="preview.running.value"
        flat
        dense
        round
        icon="stop_circle"
        size="sm"
        color="negative"
        :title="t.cancel"
        @click="preview.cancel"
      />
      <q-btn
        v-if="assets.activeAssetKind === 'model'"
        flat
        dense
        round
        icon="add_photo_alternate"
        size="sm"
        color="grey-7"
        :loading="preview.running.value"
        :title="t.generateModelCovers"
        @click="preview.open"
      />
      <q-btn-dropdown
        v-if="assets.activeAssetKind === 'model'"
        flat
        dense
        icon="filter_alt"
        size="sm"
        color="grey-7"
        :label="`${assets.pendingModelCoverCount}`"
        :title="t.modelCoverFilter"
      >
        <q-list dense>
          <q-item
            v-for="item in coverFilters"
            :key="item.value"
            clickable
            v-close-popup
            @click="assets.setModelCoverFilter(item.value)"
            ><q-item-section>{{ item.label }}</q-item-section
            ><q-item-section side>{{ item.count() }}</q-item-section></q-item
          >
        </q-list>
      </q-btn-dropdown>
      <q-btn-dropdown
        v-if="assets.activeAssetKind === 'model' && project.isSynchronized"
        flat
        dense
        icon="account_tree"
        size="sm"
        color="grey-7"
        title="Unity 项目筛选"
        ><q-list dense
          ><q-item
            v-for="item in projectFilters"
            :key="item.value"
            clickable
            v-close-popup
            @click="project.setFilter(item.value)"
            ><q-item-section>{{ item.label }}</q-item-section></q-item
          ></q-list
        ></q-btn-dropdown
      >
      <div class="topbar__sizes">
        <q-btn
          v-for="item in sizes"
          :key="item.value"
          flat
          dense
          round
          :icon="item.icon"
          size="sm"
          :color="
            settings.settings.cardSize === item.value ? 'primary' : 'grey-6'
          "
          @click="settings.setCardSize(item.value)"
        />
      </div>
      <q-btn flat dense round icon="sort" size="sm" color="grey-7"
        ><q-menu
          ><q-list dense
            ><q-item
              v-for="key in sorts"
              :key="key"
              clickable
              v-close-popup
              @click="sort(key)"
              ><q-item-section>{{ t[sortLabels[key]] }}</q-item-section
              ><q-item-section v-if="settings.settings.sortBy === key" side
                ><q-icon
                  :name="
                    settings.settings.sortOrder === 'asc'
                      ? 'arrow_upward'
                      : 'arrow_downward'
                  "
                  size="14px"
                  color="primary" /></q-item-section></q-item></q-list></q-menu
      ></q-btn>
      <q-btn
        flat
        dense
        round
        icon="refresh"
        size="sm"
        color="grey-7"
        :loading="assets.isScanning"
        :title="t.refresh"
        @click="assets.scan"
      />
      <q-btn
        flat
        dense
        round
        icon="settings"
        size="sm"
        color="grey-7"
        :title="t.settings"
        @click="emit('open-settings')"
      />
    </div>
    <ModelPreviewBatchDialog
      v-model:open="preview.dialogOpen.value"
      v-model:limit="preview.limit.value"
      v-model:current-view-only="preview.currentViewOnly.value"
      :max="preview.candidates.value.length"
      :missing="preview.missing.value.length"
      :current-view="preview.currentView.value.length"
      @start="preview.start"
    />
  </header>
</template>

<style scoped lang="scss">
@use "../styles/variables" as *;
.topbar {
  height: $topbar-height;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  border-bottom: 1px solid $color-border;
  background: $glass-background;
  backdrop-filter: $glass-blur;
  -webkit-app-region: drag;
}
.topbar__title {
  min-width: 140px;
  color: $color-text;
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
}
.topbar__search {
  flex: 1;
  max-width: 400px;
  -webkit-app-region: no-drag;
}
.topbar__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  -webkit-app-region: no-drag;
}
.topbar__progress {
  min-width: 48px;
  color: $color-secondary;
  font-size: 11px;
  text-align: right;
}
.topbar__sizes {
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 8px;
  background: var(--hover-overlay);
}
</style>
