<script setup lang="ts">
import { computed } from "vue";
import type { Asset } from "../../types/asset";
import { formatBytes } from "../../utils/formatBytes";

const props = defineProps<{
  asset: Asset;
  title: string;
  fileNameLabel: string;
  fileSizeLabel: string;
  dateLabel: string;
  pathLabel: string;
}>();
const rows = computed(() => [
  [props.fileNameLabel, props.asset.fileName],
  [props.fileSizeLabel, formatBytes(props.asset.fileSize)],
  [
    props.dateLabel,
    new Date(props.asset.createdAt).toLocaleDateString("zh-CN"),
  ],
]);
</script>

<template>
  <section class="section">
    <span class="label">{{ title }}</span>
    <div class="grid">
      <template v-for="row in rows" :key="row[0]">
        <span class="key">{{ row[0] }}</span
        ><span class="value">{{ row[1] }}</span>
      </template>
      <span class="key">{{ pathLabel }}</span>
      <span class="value path" :title="asset.filePath">{{
        asset.filePath
      }}</span>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use "../../styles/variables" as *;
.section {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}
.label {
  font-size: 11px;
  font-weight: 600;
  color: $color-secondary;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.grid {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 6px 12px;
  font-size: 12px;
}
.key {
  color: $color-secondary;
}
.value {
  color: $color-text;
  word-break: break-all;
}
.path {
  font-size: 11px;
  color: $color-secondary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
