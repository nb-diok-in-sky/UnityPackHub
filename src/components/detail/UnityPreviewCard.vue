<script setup lang="ts">
import type { PreviewEntry } from "../../services/unityImporter";
defineProps<{ entry: PreviewEntry; src: string | undefined }>();
defineEmits<{ open: []; cover: [] }>();
</script>
<template>
  <article
    class="card"
    :class="{ 'card--rendered': entry.renderType === 'rendered' }"
    :title="`${entry.name} (${entry.type})`"
    @click="$emit('open')"
  >
    <div class="card__image">
      <img v-if="src" :src="src" :alt="entry.name" /><q-icon
        v-else
        name="view_in_ar"
        size="40px"
        color="grey-5"
      /><span v-if="entry.renderType === 'rendered'">3D</span>
    </div>
    <div class="card__info">
      <strong>{{ entry.name }}</strong
      ><small>{{ entry.type }}</small>
    </div>
    <q-btn
      flat
      dense
      round
      icon="photo"
      size="xs"
      color="primary"
      class="card__cover"
      @click.stop="$emit('cover')"
    />
  </article>
</template>
<style scoped lang="scss">
@use "../../styles/variables" as *;
.card {
  position: relative;
  overflow: hidden;
  border: 1px solid $color-border;
  border-radius: 8px;
  cursor: pointer;
  transition: $transition-fast;
}
.card:hover {
  border-color: $apple-blue;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.card--rendered {
  border-color: rgba(21, 101, 192, 0.3);
}
.card__image {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  background: #1a1a1a;
}
.card__image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.card__image span {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(21, 101, 192, 0.85);
  color: white;
  font-size: 9px;
  font-weight: 700;
}
.card__info {
  display: flex;
  padding: 6px 8px;
  flex-direction: column;
  gap: 2px;
}
.card__info strong {
  overflow: hidden;
  color: $color-text;
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card__info small {
  color: $color-secondary;
  font-size: 10px;
}
.card__cover {
  position: absolute;
  top: 4px;
  left: 4px;
  background: rgba(255, 255, 255, 0.85) !important;
  opacity: 0;
}
.card:hover .card__cover {
  opacity: 1;
}
</style>
