<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import type { Asset } from '../../types/asset'
import { useAssetStore } from '../../stores/assetStore'
import { useI18n } from '../../services/i18n'

const props = defineProps<{ asset: Asset }>()
const store = useAssetStore()
const { t } = useI18n()
const editing = ref(false)
const value = ref('')
const input = ref<HTMLTextAreaElement | null>(null)

watch(() => props.asset.id, () => { editing.value = false })

function start(): void {
  value.value = props.asset.notes
  editing.value = true
  nextTick(() => input.value?.focus())
}

async function save(): Promise<void> {
  editing.value = false
  if (value.value !== props.asset.notes) await store.updateAsset(props.asset.id, { notes: value.value })
}
</script>

<template>
  <section class="notes">
    <span class="notes__label">{{ t.notes }}</span>
    <textarea v-if="editing" ref="input" v-model="value" rows="4" :placeholder="t.notesPlaceholder" @blur="save" @keydown.ctrl.enter="save" />
    <div v-else class="notes__display" @dblclick="start">
      <span v-if="asset.notes">{{ asset.notes }}</span>
      <span v-else class="notes__placeholder" @click="start">{{ t.notesPlaceholder }}</span>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;
.notes { display: flex; flex-direction: column; gap: 8px; }
.notes__label { font-size: 11px; font-weight: 600; color: $color-secondary; text-transform: uppercase; }
.notes__display { padding: 8px 10px; min-height: 40px; border-radius: $radius-input; font-size: 13px; line-height: 1.5; cursor: text; &:hover { background: var(--hover-overlay-subtle); } }
.notes__placeholder { color: $color-secondary; }
textarea { width: 100%; border: 1px solid $color-border; border-radius: $radius-input; padding: 8px 10px; font: 13px/1.5 $font-family; color: $color-text; resize: vertical; outline: none; &:focus { border-color: $apple-blue; box-shadow: 0 0 0 3px var(--accent-glow); } }
</style>

