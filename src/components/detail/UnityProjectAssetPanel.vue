<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Asset } from '../../types/asset'
import { unityService } from '../../services/unityService'
import { useAssetStore } from '../../stores/assetStore'
import { useUnityProjectStore } from '../../stores/unityProjectStore'
import { unityErrorText } from '../../composables/unityErrorText'
import { useI18n } from '../../i18n'
import { notify } from '../../ui/feedback'

const props = defineProps<{ asset: Asset }>()
const assets = useAssetStore()
const project = useUnityProjectStore()
const { t, tr } = useI18n()
const locatingPath = ref('')
const state = computed(() => project.stateOf(props.asset.id))
const duplicateAssets = computed(() =>
  project
    .duplicatesOf(props.asset.id)
    .map((id) => assets.byId.get(id))
    .filter((asset): asset is Asset => !!asset),
)
const statusLabel = computed(
  () =>
    ({
      linked: t.unityLinked,
      ambiguous: t.unityAmbiguous,
      missing: t.unityMissing,
      unlinked: t.unityUnlinked,
    })[state.value?.status ?? 'unlinked'],
)
const errorText = computed(() => (project.error ? unityErrorText(project.error) : ''))

async function locate(path: string): Promise<void> {
  if (!project.projectPath || locatingPath.value) return
  locatingPath.value = path
  try {
    await unityService.highlightProjectPath(project.projectPath, path)
  } catch (error) {
    notify.error(unityErrorText(error))
  } finally {
    locatingPath.value = ''
  }
}
</script>

<template>
  <section class="unity-project-panel">
    <div class="unity-project-panel__header">
      <span class="unity-project-panel__title">{{ t.unityProjectStatus }}</span>
      <q-btn
        flat
        dense
        no-caps
        icon="sync"
        :label="t.synchronize"
        :loading="project.syncing"
        @click="project.synchronize"
      />
    </div>
    <div v-if="errorText" class="unity-project-panel__error">{{ errorText }}</div>
    <template v-else>
      <div class="unity-project-panel__status" :class="`unity-project-panel__status--${state?.status ?? 'unlinked'}`">
        {{ statusLabel }}
      </div>
      <div v-if="state?.projectAsset" class="unity-project-panel__details">
        <span>GUID</span><code>{{ state.projectAsset.guid }}</code> <span>{{ t.unityProjectPath }}</span
        ><span>{{ state.projectAsset.path }}</span> <span>{{ t.unityAssetType }}</span
        ><span>{{ state.projectAsset.assetType }}</span> <span>{{ t.unityCurrentScene }}</span
        ><span>{{
          state.projectAsset.sceneUsageCount > 0
            ? tr('unitySceneUsage', { count: state.projectAsset.sceneUsageCount })
            : t.unityNotUsed
        }}</span>
      </div>
      <div v-if="state?.duplicateCandidates.length" class="unity-project-panel__warning">
        {{ t.unitySameName }}{{ state.duplicateCandidates.map((item) => item.path).join('、') }}
      </div>
      <div v-if="state?.projectAsset?.dependencies.length" class="unity-project-panel__links">
        <span class="unity-project-panel__title">{{ t.unityDependencies }}</span>
        <button v-for="path in state.projectAsset.dependencies" :key="path" @click="locate(path)">{{ path }}</button>
      </div>
      <div v-if="state?.projectAsset?.referencedBy.length" class="unity-project-panel__links">
        <span class="unity-project-panel__title">{{ t.unityReferencedBy }}</span>
        <button v-for="path in state.projectAsset.referencedBy" :key="path" @click="locate(path)">{{ path }}</button>
      </div>
      <div class="unity-project-panel__header">
        <span class="unity-project-panel__title">{{ t.duplicateDetection }}</span>
        <q-btn
          flat
          dense
          no-caps
          icon="fingerprint"
          :label="t.detect"
          :loading="project.scanningDuplicates"
          @click="project.findDuplicates"
        />
      </div>
      <div v-if="duplicateAssets.length" class="unity-project-panel__warning">
        {{ t.duplicateContent }}{{ duplicateAssets.map((asset) => asset.filePath).join('、') }}
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;
.unity-project-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid $color-border;
  border-radius: $radius-card;
}
.unity-project-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.unity-project-panel__title {
  font-size: 12px;
  font-weight: 600;
  color: $color-text;
}
.unity-project-panel__status,
.unity-project-panel__error,
.unity-project-panel__warning {
  font-size: 11px;
  color: $color-secondary;
}
.unity-project-panel__status--linked {
  color: #248a3d;
}
.unity-project-panel__status--ambiguous,
.unity-project-panel__warning {
  color: #b25000;
}
.unity-project-panel__status--missing,
.unity-project-panel__error {
  color: #d70015;
}
.unity-project-panel__details {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 6px;
  font-size: 11px;
  color: $color-secondary;
  word-break: break-all;
}
.unity-project-panel__details code {
  font-size: 10px;
}
.unity-project-panel__links {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 150px;
  overflow: auto;
}
.unity-project-panel__links button {
  padding: 0;
  border: 0;
  background: none;
  color: $apple-blue;
  text-align: left;
  cursor: pointer;
  font-size: 10px;
  word-break: break-all;
}
</style>
