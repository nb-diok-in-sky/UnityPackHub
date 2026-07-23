<script setup lang="ts">
import { computed } from "vue";
import type { Asset, Tag } from "../../types/asset";
import { formatBytes } from "../../utils/formatBytes";
import TagPill from "../TagPill.vue";
const props = defineProps<{ asset: Asset; tags: Tag[] }>();
const size = computed(() => formatBytes(props.asset.fileSize));
</script>
<template>
  <div class="body">
    <div class="name" :title="asset.name">{{ asset.name }}</div>
    <p v-if="asset.notes" class="notes" :title="asset.notes">
      {{ asset.notes }}
    </p>
    <div class="footer">
      <div class="tags">
        <TagPill
          v-for="tag in tags.slice(0, 3)"
          :key="tag.id"
          :tag="tag"
          small
        /><span v-if="tags.length > 3" class="more"
          >+{{ tags.length - 3 }}</span
        >
      </div>
      <span class="size">{{ size }}</span>
    </div>
  </div>
</template>
<style scoped lang="scss">
@use "../../styles/variables" as *;
.body {
  padding: 12px 14px 14px;
}
.name {
  overflow: hidden;
  color: $color-text;
  font-size: $font-size-card-name;
  font-weight: $font-weight-card-name;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notes {
  display: -webkit-box;
  margin: 4px 0 8px;
  overflow: hidden;
  color: $color-secondary;
  font-size: $font-size-notes;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
}
.tags {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 4px;
  overflow: hidden;
}
.more,
.size {
  color: $color-secondary;
  font-size: 10px;
}
.size {
  font-size: 11px;
  white-space: nowrap;
}
</style>
