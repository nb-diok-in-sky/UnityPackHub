<script setup lang="ts">
import { computed, toRef, watchEffect } from 'vue'
import type { Asset } from '../../types/asset'
import { useCoverStore } from '../../stores/coverStore'
import { useCoverInput } from '../../composables/useCoverInput'
import { useOfficialCover } from '../../composables/useOfficialCover'
import { useI18n } from '../../i18n'
import OfficialCoverDialog from './OfficialCoverDialog.vue'

const props = defineProps<{ asset: Asset }>()
const covers = useCoverStore()
const { t } = useI18n()
const asset = toRef(props, 'asset')
const input = useCoverInput(asset)
const officialCover = useOfficialCover(asset)
const coverSrc = computed(() => covers.url(props.asset.id) ?? '')

watchEffect(() => {
  if (props.asset.cover === 'stored' && !covers.url(props.asset.id)) void covers.ensure(props.asset.id)
})
</script>

<template>
  <div
    class="asset-cover"
    :class="{ 'asset-cover--dragover': input.isDragOver.value }"
    @dragover.prevent="input.isDragOver.value = true"
    @dragleave="input.isDragOver.value = false"
    @drop="input.handleDrop"
  >
    <img v-if="coverSrc" :src="coverSrc" :alt="asset.name" class="asset-cover__image" />
    <div v-else class="asset-cover__placeholder">
      <q-icon name="add_photo_alternate" size="32px" color="grey-5" />
      <span>{{ t.coverDropHint }}</span>
    </div>
    <label class="asset-cover__picker" :title="t.chooseLocalCover">
      <input type="file" accept="image/*" @change="input.fromFile(($event.target as HTMLInputElement).files?.[0])" />
      <q-icon name="add_photo_alternate" size="18px" />
    </label>
    <q-btn
      v-if="coverSrc"
      flat
      round
      dense
      icon="close"
      size="xs"
      class="asset-cover__remove"
      @click.stop="input.remove"
    />
    <q-btn
      v-if="asset.assetKind === 'package'"
      unelevated
      dense
      no-caps
      icon="storefront"
      :label="t.officialCover"
      color="primary"
      class="asset-cover__official"
      @click.stop="officialCover.openDialog"
    />
  </div>

  <OfficialCoverDialog
    v-model="officialCover.dialogOpen.value"
    v-model:product-url="officialCover.productUrl.value"
    :product="officialCover.product.value"
    :loading="officialCover.loading.value"
    :error="officialCover.error.value"
    @search="officialCover.openSearch"
    @resolve="officialCover.resolveProduct"
    @apply="officialCover.applyCover"
  />
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;
.asset-cover {
  position: relative;
  width: 100%;
  height: 194px;
  min-height: 194px;
  flex: 0 0 194px;
  border-radius: $radius-card;
  overflow: hidden;
  background: $color-divider;
  border: 2px dashed transparent;
  transition: $transition-fast;
}
.asset-cover--dragover {
  border-color: $apple-blue;
  background: var(--accent-soft);
}
.asset-cover__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.asset-cover__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: $color-secondary;
}
.asset-cover__picker {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: white;
  background: var(--cover-remove-bg);
  cursor: pointer;
}
.asset-cover__picker input {
  display: none;
}
.asset-cover__remove {
  position: absolute;
  top: 6px;
  right: 6px;
  background: var(--cover-remove-bg) !important;
  color: white !important;
}
.asset-cover__official {
  position: absolute;
  left: 8px;
  bottom: 8px;
  border-radius: $radius-button;
  font-size: 12px;
}
</style>
