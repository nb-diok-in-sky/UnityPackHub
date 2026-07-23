<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import type { Asset } from "../types/asset";
import { useI18n } from "../services/i18n";
import { useAssetDetailActions } from "../composables/useAssetDetailActions";
import ShowcaseSection from "./detail/ShowcaseSection.vue";
import ModelShowcaseSection from "./detail/ModelShowcaseSection.vue";
import UnityPreviewsSection from "./detail/UnityPreviewsSection.vue";
import AssetCoverEditor from "./detail/AssetCoverEditor.vue";
import AssetNotesEditor from "./detail/AssetNotesEditor.vue";
import AssetTagEditor from "./detail/AssetTagEditor.vue";
import UnityProjectAssetPanel from "./detail/UnityProjectAssetPanel.vue";
import AssetDetailHeader from "./detail/AssetDetailHeader.vue";
import AssetDetailActions from "./detail/AssetDetailActions.vue";
import AssetFileInfo from "./detail/AssetFileInfo.vue";

const props = defineProps<{ asset: Asset | null }>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();
const actions = useAssetDetailActions(toRef(props, "asset"));
const showcaseRef = ref<InstanceType<typeof ShowcaseSection> | null>(null);
const modelShowcaseRef = ref<InstanceType<typeof ModelShowcaseSection> | null>(
  null,
);
const previewsRef = ref<InstanceType<typeof UnityPreviewsSection> | null>(null);
const isModel = computed(() => props.asset?.assetKind === "model");

watch(
  () => props.asset?.id,
  () => {
    actions.resetStatus();
    showcaseRef.value?.reset();
    modelShowcaseRef.value?.reset();
    previewsRef.value?.reset();
    if (props.asset) previewsRef.value?.loadPreviews();
  },
);
</script>

<template>
  <Transition name="drawer">
    <div v-if="asset" class="overlay" @click.self="emit('close')">
      <div class="panel">
        <AssetDetailHeader :title="t.details" @close="emit('close')" />
        <div class="scroll">
          <AssetCoverEditor :asset="asset" />
          <AssetDetailActions
            :is-model="isModel"
            :is-favorite="asset.isFavorite"
            :is-importing="actions.isImporting.value"
            :is-locating="actions.isLocatingInUnity.value"
            :status="actions.status.value"
            :importing-label="t.importing"
            :import-label="t.importToUnity"
            :reveal-label="t.openFileLocation"
            @favorite="actions.toggleFavorite"
            @import="actions.importAsset"
            @reveal="actions.revealFile"
            @locate="actions.locateInUnity"
            @search-store="actions.searchUnityStore"
          >
            <template #name
              ><h3 class="asset-name">{{ asset.name }}</h3></template
            >
          </AssetDetailActions>

          <AssetNotesEditor :asset="asset" />
          <AssetTagEditor :asset="asset" />
          <UnityProjectAssetPanel v-if="isModel" :asset="asset" />
          <AssetFileInfo
            :asset="asset"
            :title="t.fileInfo"
            :file-name-label="t.fileName"
            :file-size-label="t.fileSize"
            :date-label="t.dateAdded"
            :path-label="t.filePath"
          />
          <ShowcaseSection v-if="!isModel" ref="showcaseRef" :asset="asset" />
          <ModelShowcaseSection v-else ref="modelShowcaseRef" :asset="asset" />
          <UnityPreviewsSection
            v-if="!isModel"
            ref="previewsRef"
            :asset="asset"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
@use "../styles/variables" as *;
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: var(--overlay-bg);
}
.panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 380px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: $color-surface;
  font-family: $font-family;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
  border-left: 1px solid $color-border;
}
.scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.asset-name {
  flex: 1;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: $color-text;
  word-break: break-word;
}
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
  .panel {
    transition: transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);
  }
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
  .panel {
    transform: translateX(100%);
  }
}
</style>
