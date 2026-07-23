<script setup lang="ts">
import type { PackageAssetEntry } from "../../services/coverFetcher";

const props = defineProps<{
  entry: PackageAssetEntry;
  thumbnail: string | null;
}>();
const icons: Record<string, string> = {
  Prefab: "widgets",
  Texture: "image",
  Script: "description",
};

function drag(event: DragEvent): void {
  if (!props.thumbnail || !event.dataTransfer) return;
  event.dataTransfer.setData("application/cover-image", props.thumbnail);
  event.dataTransfer.effectAllowed = "copy";
}
</script>

<template>
  <div
    class="card"
    :title="entry.pathname"
    :draggable="!!thumbnail"
    @dragstart="drag"
  >
    <div class="card__preview">
      <img
        v-if="thumbnail"
        :src="thumbnail"
        :alt="entry.filename"
        loading="lazy"
      />
      <q-icon
        v-else
        :name="icons[entry.asset_type] ?? 'insert_drive_file'"
        size="32px"
        color="grey-5"
      />
      <span
        :class="`card__badge card__badge--${entry.asset_type.toLowerCase()}`"
        >{{ entry.asset_type }}</span
      >
    </div>
    <div class="card__name" :title="entry.filename">{{ entry.filename }}</div>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/variables" as *;
.card {
  width: calc(50% - 4px);
  flex-shrink: 0;
  border: 1px solid $color-border;
  border-radius: 8px;
  overflow: hidden;
  transition: $transition-fast;
  &:hover {
    border-color: $apple-blue;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
}
.card__preview {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 120px;
  overflow: hidden;
  background: $color-divider;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
.card__badge {
  position: absolute;
  top: 4px;
  left: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
}
.card__badge--prefab {
  background: rgba(230, 81, 0, 0.8);
}
.card__badge--texture {
  background: rgba(21, 101, 192, 0.8);
}
.card__badge--script {
  background: rgba(0, 105, 92, 0.8);
}
.card__name {
  padding: 6px 8px;
  overflow: hidden;
  color: $color-text;
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
