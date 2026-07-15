<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Asset, Tag } from '../../types/asset'
import { useAssetStore } from '../../stores/assetStore'
import { useTagStore } from '../../stores/tagStore'
import { useI18n } from '../../services/i18n'
import TagPill from '../TagPill.vue'

const props = defineProps<{ asset: Asset }>()
const assets = useAssetStore()
const tags = useTagStore()
const { t } = useI18n()
const open = ref(false)
watch(() => props.asset.id, () => { open.value = false })

const assigned = computed(() => props.asset.tagIds.map(tags.getTagById).filter((tag): tag is Tag => Boolean(tag)))
const available = computed(() => tags.tags.filter((tag) => !props.asset.tagIds.includes(tag.id)))

async function add(id: string): Promise<void> {
  await assets.updateAsset(props.asset.id, { tagIds: [...props.asset.tagIds, id] })
  open.value = false
}
async function remove(id: string): Promise<void> {
  await assets.updateAsset(props.asset.id, { tagIds: props.asset.tagIds.filter((value) => value !== id) })
}
</script>

<template>
  <section class="tags">
    <header><span>{{ t.tags }}</span><q-btn flat round dense icon="add" size="xs" @click="open = !open" /></header>
    <div class="tags__assigned">
      <div v-for="tag in assigned" :key="tag.id" class="tags__item"><TagPill :tag="tag" /><q-btn flat round dense icon="close" size="8px" @click="remove(tag.id)" /></div>
      <span v-if="!assigned.length" class="tags__empty">{{ t.noTags }}</span>
    </div>
    <div v-if="open && available.length" class="tags__picker">
      <button v-for="tag in available" :key="tag.id" @click="add(tag.id)"><i :style="{ background: tag.color }" />{{ tag.label }}</button>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;
.tags { display: flex; flex-direction: column; gap: 8px; }
header { display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-weight: 600; color: $color-secondary; text-transform: uppercase; }
.tags__assigned { display: flex; flex-wrap: wrap; gap: 6px; min-height: 28px; align-items: center; }
.tags__item { display: flex; align-items: center; gap: 2px; }
.tags__empty { font-size: 12px; color: $color-secondary; }
.tags__picker { display: flex; flex-direction: column; gap: 2px; padding: 6px; border: 1px solid $color-border; border-radius: $radius-input; box-shadow: $shadow-dropdown; }
button { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 0; border-radius: 6px; background: transparent; color: $color-text; cursor: pointer; &:hover { background: var(--hover-overlay); } }
i { width: 10px; height: 10px; border-radius: 50%; }
</style>
