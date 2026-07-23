<script setup lang="ts">
import { computed } from "vue";
import type { Asset } from "../types/asset";
import { useAssetStore } from "../stores/assetStore";
import { useTagStore } from "../stores/tagStore";
import { useGroupStore } from "../stores/groupStore";
import { importToUnity, openFileLocation } from "../services/unityImporter";
import AssetCardCover from "./asset/AssetCardCover.vue";
import AssetCardMenu from "./asset/AssetCardMenu.vue";
import AssetCardBody from "./asset/AssetCardBody.vue";
const props = defineProps<{ asset: Asset; width: number }>();
const emit = defineEmits<{
  click: [asset: Asset];
  "update:favorite": [id: string];
}>();
const assets = useAssetStore();
const tags = useTagStore();
const groups = useGroupStore();
const selected = computed(() => assets.selectedIds.has(props.asset.id));
const assetTags = computed(() =>
  props.asset.tagIds
    .map((id) => tags.getTagById(id))
    .filter((tag): tag is NonNullable<typeof tag> => !!tag),
);
const manualGroups = computed(() =>
  groups.groups.filter(
    (group) =>
      group.source !== "classification" &&
      (group.assetKind === undefined ||
        group.assetKind === props.asset.assetKind),
  ),
);
function click(event: MouseEvent) {
  if (assets.paintingTagId) {
    assets.paintTag(props.asset.id);
    return;
  }
  if (event.shiftKey) assets.rangeSelect(props.asset.id);
  else if (event.ctrlKey || event.metaKey)
    assets.toggleSelection(props.asset.id);
  else emit("click", props.asset);
}
function favorite(event?: MouseEvent) {
  event?.stopPropagation();
  emit("update:favorite", props.asset.id);
}
</script>
<template>
  <article
    class="card"
    :class="{
      'card--selected': selected,
      'card--painting': !!assets.paintingTagId,
    }"
    :style="{ width: `${width}px` }"
    @click="click"
    @dblclick.prevent="importToUnity(asset.filePath)"
  >
    <AssetCardCover :asset="asset" @favorite="favorite" /><AssetCardMenu
      :asset="asset"
      :groups="manualGroups"
      @open="importToUnity(asset.filePath)"
      @reveal="openFileLocation(asset.filePath)"
      @favorite="favorite()"
      @group="groups.addAsset($event, asset.id)"
    /><AssetCardBody :asset="asset" :tags="assetTags" />
  </article>
</template>
<style scoped lang="scss">
@use "../styles/variables" as *;
.card {
  position: relative;
  overflow: hidden;
  border-radius: $radius-card;
  background: $color-surface;
  box-shadow: $shadow-card;
  cursor: pointer;
  transition: $transition-default;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: $shadow-card-hover;
}
.card--selected {
  outline: 2px solid $apple-blue;
  outline-offset: -2px;
}
.card--painting {
  cursor: crosshair;
}
</style>
