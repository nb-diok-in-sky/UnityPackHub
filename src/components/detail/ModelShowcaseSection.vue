<script setup lang="ts">
import { computed } from "vue";
import type { Asset } from "../../types/asset";
import type { FilterOption } from "../../types/ui";
import { useI18n } from "../../services/i18n";
import { commands } from "../../services/tauriCommands";
import {
  useModelShowcase,
  type ModelFileFilter,
} from "../../composables/useModelShowcase";
import ModelMetadataPanel from "./ModelMetadataPanel.vue";
import ModelRelatedFileRow from "./ModelRelatedFileRow.vue";
import CollapsibleSectionHeader from "../shared/CollapsibleSectionHeader.vue";
import FilterChipBar from "../shared/FilterChipBar.vue";
import SectionState from "../shared/SectionState.vue";
const props = defineProps<{ asset: Asset }>();
const { t } = useI18n();
const showcase = useModelShowcase(() => props.asset);
const filters: Array<{ value: ModelFileFilter; icon?: string; label: string }> =
  [
    { value: "all", label: t.assetTypeAll },
    { value: "texture", icon: "image", label: t.assetTypeTexture },
    { value: "material", icon: "palette", label: t.assetTypeMaterial },
    { value: "model", icon: "view_in_ar", label: t.assetTypeModel },
    { value: "prefab", icon: "widgets", label: t.assetTypePrefab },
  ];
const filterOptions = computed<FilterOption<ModelFileFilter>[]>(() =>
  filters.map((item) => ({
    ...item,
    count: showcase.counts.value[item.value] ?? 0,
    hidden: item.value !== "all" && !showcase.counts.value[item.value],
  })),
);
defineExpose({ reset: showcase.reset });
</script>
<template>
  <section class="showcase">
    <CollapsibleSectionHeader
      :title="t.modelShowcase"
      :open="showcase.open.value"
      :loading="showcase.loading.value"
      @toggle="showcase.toggle"
    />
    <SectionState
      :loading="showcase.loading.value"
      :loading-text="t.loadingContents"
    />
    <template v-if="showcase.open.value && !showcase.loading.value"
      ><ModelMetadataPanel
        v-if="showcase.metadata.value"
        :metadata="showcase.metadata.value"
      />
      <FilterChipBar
        v-if="showcase.files.value.length"
        :options="filterOptions"
        :active="showcase.filter.value"
        @select="showcase.filter.value = $event"
      />
      <div class="count">
        {{ showcase.filtered.value.length }} / {{ showcase.files.value.length }}
      </div>
      <div class="list">
        <ModelRelatedFileRow
          v-for="file in showcase.filtered.value"
          :key="file.filePath"
          :file="file"
          @open="commands.revealInExplorer(file.filePath)"
        />
      </div>
      <SectionState
        :empty="!showcase.filtered.value.length"
        :empty-text="t.noRelatedFiles"
      />
    </template>
  </section>
</template>
<style scoped lang="scss">
@use "../../styles/variables" as *;
.showcase {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.count {
  color: $color-secondary;
  font-size: 11px;
}
.list {
  display: flex;
  max-height: 400px;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}
</style>
