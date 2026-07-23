<script setup lang="ts">
import { computed } from "vue";
import type { Asset } from "../../types/asset";
import { useI18n } from "../../services/i18n";
import {
  PACKAGE_SHOWCASE_TYPES,
  usePackageShowcase,
} from "../../composables/usePackageShowcase";
import PackageShowcaseCard from "./PackageShowcaseCard.vue";
import CollapsibleSectionHeader from "../shared/CollapsibleSectionHeader.vue";
import FilterChipBar from "../shared/FilterChipBar.vue";
import SectionState from "../shared/SectionState.vue";
import type { FilterOption } from "../../types/ui";

const props = defineProps<{ asset: Asset }>();
const { t } = useI18n();
const showcase = usePackageShowcase(() => props.asset);
const icons: Record<string, string> = {
  Prefab: "widgets",
  Texture: "image",
  Script: "description",
};
const filterOptions = computed<
  FilterOption<(typeof PACKAGE_SHOWCASE_TYPES)[number] | "All">[]
>(() =>
  (["All", ...PACKAGE_SHOWCASE_TYPES] as const).map((value) => ({
    value,
    label:
      value === "All"
        ? t.assetTypeAll
        : t[`assetType${value}` as keyof typeof t],
    count: showcase.typeCounts.value[value] ?? 0,
    ...(value === "All" ? {} : { icon: icons[value] }),
  })),
);

defineExpose({ reset: showcase.reset });
</script>

<template>
  <section class="showcase">
    <CollapsibleSectionHeader
      :title="t.assetShowcase"
      :open="showcase.open.value"
      :loading="showcase.loading.value"
      @toggle="showcase.toggle"
    >
      <template #actions>
        <q-btn
          v-if="showcase.open.value"
          flat
          round
          dense
          icon="delete_sweep"
          size="xs"
          color="grey-7"
          title="清除所有预览图"
          @click="showcase.clearPreviews"
        />
        <q-btn
          v-if="showcase.open.value"
          flat
          round
          dense
          icon="refresh"
          size="xs"
          color="grey-7"
          title="刷新"
          @click="showcase.load(true)"
        />
      </template>
    </CollapsibleSectionHeader>

    <SectionState
      :loading="showcase.loading.value"
      :loading-text="t.loadingContents"
    />

    <template v-if="showcase.open.value && showcase.data.value">
      <FilterChipBar
        :options="filterOptions"
        :active="showcase.filter.value"
        @select="showcase.filter.value = $event"
      />
      <div class="showcase__count">
        {{ showcase.filteredEntries.value.length }} /
        {{ showcase.entries.value.length }}
      </div>
      <div class="showcase__grid">
        <PackageShowcaseCard
          v-for="entry in showcase.filteredEntries.value"
          :key="entry.guid"
          :entry="entry"
          :thumbnail="showcase.thumbnail(entry)"
        />
      </div>
      <SectionState
        :empty="showcase.filteredEntries.value.length === 0"
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
.showcase__count {
  color: $color-secondary;
  font-size: 11px;
}
.showcase__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 480px;
  overflow-y: auto;
  padding: 2px;
  align-content: flex-start;
}
</style>
