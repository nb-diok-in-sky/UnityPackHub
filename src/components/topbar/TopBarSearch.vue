<script setup lang="ts">
import { onUnmounted } from "vue";
import { useAssetStore } from "../../stores/assetStore";
import { useI18n } from "../../services/i18n";
const assets = useAssetStore();
const { t } = useI18n();
let timer: ReturnType<typeof setTimeout> | null = null;
function update(value: string) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => assets.setSearch(value), 200);
}
onUnmounted(() => {
  if (timer) clearTimeout(timer);
});
</script>
<template>
  <q-input
    :model-value="assets.searchQuery"
    dense
    outlined
    :placeholder="t.search"
    class="search"
    @update:model-value="update($event as string)"
    ><template #prepend
      ><q-icon name="search" size="18px" color="grey-6" /></template
    ><template v-if="assets.searchQuery" #append
      ><q-icon
        name="close"
        size="16px"
        color="grey-5"
        class="cursor-pointer"
        @click="update('')" /></template
  ></q-input>
</template>
<style scoped lang="scss">
@use "../../styles/variables" as *;
.search {
  :deep(.q-field__control) {
    height: 34px;
    border: none;
    border-radius: $radius-input;
    background: var(--hover-overlay);
    &::before {
      border: none;
    }
  }
  :deep(.q-field__native) {
    padding: 0;
    font-size: 13px;
  }
}
</style>
