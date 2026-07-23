<script setup lang="ts">
import { computed } from "vue";
import type { Asset } from "../../types/asset";
import { useI18n } from "../../services/i18n";
import { useUnityPackagePreviews } from "../../composables/useUnityPackagePreviews";
import SectionState from "../shared/SectionState.vue";
import ImageLightbox from "../shared/ImageLightbox.vue";
import UnityPreviewCard from "./UnityPreviewCard.vue";
const props = defineProps<{ asset: Asset }>();
const { t } = useI18n();
const previews = useUnityPackagePreviews(() => props.asset);
const selectedImage = computed(() =>
  previews.selected.value
    ? (previews.images.value[previews.selected.value.preview] ?? "")
    : "",
);
const lightboxOpen = computed({
  get: () => !!previews.selected.value,
  set: (value) => {
    if (!value) previews.selected.value = null;
  },
});
defineExpose({ reset: previews.reset, loadPreviews: previews.load });
</script>
<template>
  <section
    v-if="previews.loading.value || previews.data.value?.entries.length"
    class="section"
  >
    <header>
      {{ t.unityPreviews
      }}<span v-if="previews.data.value">{{
        previews.data.value.entries.length
      }}</span>
    </header>
    <SectionState
      :loading="previews.loading.value"
      :loading-text="t.loadingPreviews"
      ><div class="grid">
        <UnityPreviewCard
          v-for="entry in previews.data.value?.entries ?? []"
          :key="entry.preview"
          :entry="entry"
          :src="previews.images.value[entry.preview]"
          @open="previews.selected.value = entry"
          @cover="previews.useAsCover(entry)"
        /></div></SectionState
    ><ImageLightbox
      v-if="previews.selected.value && selectedImage"
      v-model="lightboxOpen"
      :src="selectedImage"
      :title="previews.selected.value.name"
      :subtitle="previews.selected.value.type"
      ><template #actions
        ><q-btn
          flat
          dense
          no-caps
          icon="photo"
          :label="t.useAsPreview"
          color="primary"
          @click="previews.useAsCover(previews.selected.value!)" /></template
    ></ImageLightbox>
  </section>
</template>
<style scoped lang="scss">
@use "../../styles/variables" as *;
.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.section > header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: $color-secondary;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}
.section > header span {
  padding: 1px 6px;
  border-radius: 8px;
  background: $color-divider;
  font-size: 10px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  max-height: 600px;
  overflow-y: auto;
  padding: 2px;
}
</style>
