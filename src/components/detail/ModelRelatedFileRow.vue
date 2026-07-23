<script setup lang="ts">
import type { RelatedFile } from "../../services/tauriCommands";
import { formatBytes } from "../../utils/formatBytes";
import { useI18n } from "../../services/i18n";
defineProps<{ file: RelatedFile }>();
defineEmits<{ open: [] }>();
const { t } = useI18n();
const icons: Record<string, string> = {
  texture: "image",
  material: "palette",
  prefab: "widgets",
  model: "view_in_ar",
};
const labels: Record<string, string> = {
  texture: t.assetTypeTexture,
  material: t.assetTypeMaterial,
  prefab: t.assetTypePrefab,
  model: t.assetTypeModel,
};
</script>
<template>
  <button class="row" :title="file.filePath" @click="$emit('open')">
    <span class="row__icon"
      ><q-icon
        :name="icons[file.fileType] ?? 'insert_drive_file'"
        size="24px"
        color="grey-5" /></span
    ><span class="row__info"
      ><strong>{{ file.fileName }}</strong
      ><small
        >{{ labels[file.fileType] ?? t.assetTypeOther }} ·
        {{ formatBytes(file.fileSize) }}</small
      ></span
    ><span class="row__badge" :class="`row__badge--${file.fileType}`">{{
      labels[file.fileType] ?? t.assetTypeOther
    }}</span>
  </button>
</template>
<style scoped lang="scss">
@use "../../styles/variables" as *;
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid $color-border;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.row:hover {
  border-color: $apple-blue;
  background: var(--hover-overlay-subtle);
}
.row__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: $color-divider;
}
.row__info {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.row__info strong {
  overflow: hidden;
  color: $color-text;
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row__info small {
  color: $color-secondary;
  font-size: 10px;
}
.row__badge {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(99, 99, 102, 0.15);
  font-size: 8px;
  font-weight: 700;
}
.row__badge--texture {
  color: #1565c0;
}
.row__badge--material {
  color: #9c27b0;
}
.row__badge--model {
  color: #ef6c00;
}
.row__badge--prefab {
  color: #2e7d32;
}
</style>
