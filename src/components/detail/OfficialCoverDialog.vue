<script setup lang="ts">
import type { AssetStoreProduct } from '../../services/unityAssetStoreClient'

defineProps<{
  modelValue: boolean
  productUrl: string
  product: AssetStoreProduct | null
  loading: boolean
  error: string
}>()
defineEmits<{
  'update:modelValue': [value: boolean]
  'update:productUrl': [value: string]
  search: []
  resolve: []
  apply: []
}>()
</script>

<template>
  <q-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)">
    <q-card class="official-cover-dialog">
      <q-card-section>
        <div class="text-h6">获取官方商城封面</div>
        <div class="hint">先在 Unity Asset Store 中确认正确商品，再复制商品详情页链接。</div>
      </q-card-section>

      <q-card-section class="content">
        <q-btn outline no-caps icon="search" label="打开官方搜索" color="primary" @click="$emit('search')" />
        <div class="url-row">
          <q-input
            :model-value="productUrl"
            outlined dense clearable class="url-input"
            label="Unity Asset Store 商品链接"
            placeholder="https://assetstore.unity.com/packages/..."
            @update:model-value="$emit('update:productUrl', String($event ?? ''))"
            @keyup.enter="$emit('resolve')"
          />
          <q-btn unelevated no-caps label="读取" color="primary" :loading="loading" @click="$emit('resolve')" />
        </div>

        <div v-if="error" class="error-message">
          <q-icon name="error_outline" size="16px" />
          <span>{{ error }}</span>
        </div>

        <div v-if="product" class="candidate">
          <img :src="product.imageUrl" :alt="product.name" />
          <div class="candidate__info">
            <strong>{{ product.name }}</strong>
            <span>商品 ID：{{ product.packageId }}</span>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="取消" color="grey" @click="$emit('update:modelValue', false)" />
        <q-btn
          unelevated label="使用此封面" color="primary"
          :disable="!product || loading" :loading="loading" @click="$emit('apply')"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;
.official-cover-dialog { width: min(620px, 92vw); border-radius: $radius-dialog; }
.hint { margin-top: 6px; color: $color-secondary; font-size: 12px; }
.content { display: flex; flex-direction: column; gap: 14px; }
.url-row { display: flex; align-items: center; gap: 8px; }
.url-input { flex: 1; }
.error-message { display: flex; align-items: center; gap: 6px; color: $apple-red; font-size: 12px; }
.candidate { display: grid; grid-template-columns: 180px 1fr; gap: 14px; padding: 10px; border: 1px solid $color-border; border-radius: $radius-card; }
.candidate img { width: 180px; height: 120px; object-fit: cover; border-radius: 8px; background: $color-divider; }
.candidate__info { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.candidate__info strong { color: $color-text; word-break: break-word; }
.candidate__info span { color: $color-secondary; font-size: 12px; }
@media (max-width: 520px) {
  .url-row { align-items: stretch; flex-direction: column; }
  .candidate { grid-template-columns: 1fr; }
  .candidate img { width: 100%; height: auto; aspect-ratio: 3 / 2; }
}
</style>
