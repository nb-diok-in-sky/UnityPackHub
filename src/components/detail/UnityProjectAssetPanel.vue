<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Asset } from '../../types/asset'
import { useAssetStore } from '../../stores/assetStore'
import { useUnityProjectStore } from '../../stores/unityProjectStore'
import { unityProjectService } from '../../services/unityProjectService'
import { useDuplicateAssetStore } from '../../stores/duplicateAssetStore'

const props = defineProps<{ asset: Asset }>()
const assetStore = useAssetStore()
const projectStore = useUnityProjectStore()
const duplicateStore = useDuplicateAssetStore()
const locatingPath = ref('')
const state = computed(() => projectStore.getState(props.asset.id))
const duplicateAssets = computed(() => duplicateStore.getDuplicateIds(props.asset.id)
  .map((id) => assetStore.assets.find((asset) => asset.id === id)).filter(Boolean))
const statusLabel = computed(() => ({
  linked: '已关联到 Unity 项目', ambiguous: '发现多个同名候选',
  missing: '原有 GUID 关联已失效', unlinked: 'Unity 项目中未找到',
})[state.value?.status ?? 'unlinked'])

async function synchronize(): Promise<void> {
  try { await projectStore.synchronize(assetStore.assets) } catch { /* displayed by store */ }
}

async function locate(path: string): Promise<void> {
  if (!projectStore.projectPath || locatingPath.value) return
  locatingPath.value = path
  try { await unityProjectService.highlightProjectAsset(projectStore.projectPath, path) }
  finally { locatingPath.value = '' }
}
</script>

<template>
  <section class="unity-project-panel">
    <div class="unity-project-panel__header">
      <span class="unity-project-panel__title">Unity 项目状态</span>
      <q-btn flat dense no-caps icon="sync" label="同步" :loading="projectStore.syncing" @click="synchronize" />
    </div>
    <div v-if="projectStore.error" class="unity-project-panel__error">{{ projectStore.error }}</div>
    <template v-else>
      <div class="unity-project-panel__status" :class="`unity-project-panel__status--${state?.status ?? 'unlinked'}`">{{ statusLabel }}</div>
      <div v-if="state?.projectAsset" class="unity-project-panel__details">
        <span>GUID</span><code>{{ state.projectAsset.guid }}</code>
        <span>项目路径</span><span>{{ state.projectAsset.path }}</span>
        <span>资源类型</span><span>{{ state.projectAsset.assetType }}</span>
        <span>当前场景</span><span>{{ state.projectAsset.sceneUsageCount > 0 ? `使用 ${state.projectAsset.sceneUsageCount} 次` : '未使用' }}</span>
      </div>
      <div v-if="state?.duplicateCandidates.length" class="unity-project-panel__warning">
        同名资源：{{ state.duplicateCandidates.map((item) => item.path).join('、') }}
      </div>
      <div v-if="state?.projectAsset?.dependencies.length" class="unity-project-panel__links">
        <span class="unity-project-panel__title">直接依赖</span>
        <button v-for="path in state.projectAsset.dependencies" :key="path" @click="locate(path)">{{ path }}</button>
      </div>
      <div v-if="state?.projectAsset?.referencedBy.length" class="unity-project-panel__links">
        <span class="unity-project-panel__title">被以下资源引用</span>
        <button v-for="path in state.projectAsset.referencedBy" :key="path" @click="locate(path)">{{ path }}</button>
      </div>
      <div class="unity-project-panel__header">
        <span class="unity-project-panel__title">内容重复检测</span>
        <q-btn flat dense no-caps icon="fingerprint" label="检测" :loading="duplicateStore.scanning" @click="duplicateStore.scan(assetStore.assets)" />
      </div>
      <div v-if="duplicateAssets.length" class="unity-project-panel__warning">
        发现相同内容：{{ duplicateAssets.map((asset) => asset?.filePath).join('、') }}
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;
.unity-project-panel { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid $color-border; border-radius: $radius-card; }
.unity-project-panel__header { display: flex; align-items: center; justify-content: space-between; }
.unity-project-panel__title { font-size: 12px; font-weight: 600; color: $color-text; }
.unity-project-panel__status, .unity-project-panel__error, .unity-project-panel__warning { font-size: 11px; color: $color-secondary; }
.unity-project-panel__status--linked { color: #248a3d; }
.unity-project-panel__status--ambiguous, .unity-project-panel__warning { color: #b25000; }
.unity-project-panel__status--missing, .unity-project-panel__error { color: #d70015; }
.unity-project-panel__details { display: grid; grid-template-columns: 72px 1fr; gap: 6px; font-size: 11px; color: $color-secondary; word-break: break-all; }
.unity-project-panel__details code { font-size: 10px; }
.unity-project-panel__links { display: flex; flex-direction: column; gap: 4px; max-height: 150px; overflow: auto; }
.unity-project-panel__links button { padding: 0; border: 0; background: none; color: $apple-blue; text-align: left; cursor: pointer; font-size: 10px; word-break: break-all; }
</style>
