<script setup lang="ts">
import { computed } from 'vue'
import type { Asset } from '../types/asset'
import { addTag, setFavorite } from '../domain/assetChanges'
import { fileService } from '../services/fileService'
import { useAssetStore } from '../stores/assetStore'
import { useBrowseStore } from '../stores/browseStore'
import { useGroupStore } from '../stores/groupStore'
import { useTagStore } from '../stores/tagStore'
import { useAssetActions } from '../composables/useAssetActions'
import AssetCardCover from './asset/AssetCardCover.vue'
import AssetCardMenu from './asset/AssetCardMenu.vue'
import AssetCardBody from './asset/AssetCardBody.vue'
const props = defineProps<{ asset: Asset; width: number; height: number }>()
const emit = defineEmits<{ open: [asset: Asset] }>()
const assets = useAssetStore()
const browse = useBrowseStore()
const tags = useTagStore()
const groups = useGroupStore()
const actions = useAssetActions()
const selected = computed(() => browse.selectedIds.has(props.asset.id))
const assetTags = computed(() =>
  props.asset.tagIds.map((id) => tags.getTagById(id)).filter((tag): tag is NonNullable<typeof tag> => !!tag),
)
const manualGroups = computed(() =>
  groups.manualGroups.filter((group) => group.assetKind === undefined || group.assetKind === props.asset.assetKind),
)
const activeGroupName = computed(() =>
  browse.activeManualGroup?.assetIds.includes(props.asset.id) ? browse.activeManualGroup.name : null,
)
function click(event: MouseEvent) {
  if (browse.paintingTagId) void assets.edit([props.asset.id], addTag(browse.paintingTagId))
  else if (event.shiftKey) browse.selectRange(props.asset.id)
  else if (event.ctrlKey || event.metaKey) browse.toggleSelected(props.asset.id)
  else emit('open', props.asset)
}
function importToUnity() {
  if (!browse.paintingTagId) void actions.importToUnity(props.asset)
}
function toggleFavorite(event?: MouseEvent) {
  event?.stopPropagation()
  void assets.edit([props.asset.id], setFavorite(!props.asset.isFavorite))
}
</script>
<template>
  <article
    class="card"
    :class="{
      'card--selected': selected,
      'card--painting': !!browse.paintingTagId,
    }"
    :style="{ width: `${width}px`, height: `${height}px` }"
    @click="click"
    @dblclick.prevent="importToUnity"
  >
    <AssetCardCover :asset="asset" @favorite="toggleFavorite" />
    <AssetCardMenu
      :asset="asset"
      :groups="manualGroups"
      :tags="tags.tags"
      :active-group-name="activeGroupName"
      @open="importToUnity"
      @reveal="fileService.reveal(asset.filePath)"
      @favorite="toggleFavorite()"
      @group="groups.addAssets($event, [asset.id])"
      @tag="actions.toggleTag(asset, $event)"
      @remove-from-group="actions.removeFromActiveGroup([asset.id])"
      @remove="actions.removeFromLibrary([asset.id])"
    />
    <AssetCardBody :asset="asset" :tags="assetTags" />
  </article>
</template>
<style scoped lang="scss">
@use '../styles/variables' as *;
.card {
  display: flex;
  flex-direction: column;
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
