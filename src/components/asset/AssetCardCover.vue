<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import type { Asset } from '../../types/asset'
import { modelCoverStatus } from '../../domain/modelCover'
import { useCoverStore } from '../../stores/coverStore'
import { useUnityProjectStore } from '../../stores/unityProjectStore'
import { useI18n } from '../../i18n'
const props = defineProps<{ asset: Asset }>()
const emit = defineEmits<{ favorite: [event: MouseEvent] }>()
const covers = useCoverStore()
const project = useUnityProjectStore()
const { t, tr } = useI18n()
const src = computed(() => covers.url(props.asset.id) ?? '')
const initial = computed(() => props.asset.name.trim().charAt(0).toUpperCase())
const status = computed(() => modelCoverStatus(props.asset))
const unity = computed(() => project.stateOf(props.asset.id))
const statusText = computed(
  () =>
    ({
      pending: t.modelCoverPending,
      completed: t.modelCoverCompleted,
      failed: t.modelCoverFailed,
      'not-needed': t.modelCoverNotNeeded,
    })[status.value],
)
const statusIcon = {
  pending: 'hourglass_empty',
  completed: 'check_circle',
  failed: 'error',
  'not-needed': 'remove_circle_outline',
}
// Also re-runs when the cache evicts this cover, so a visible card never stays blank.
watchEffect(() => {
  if (props.asset.cover === 'stored' && !covers.url(props.asset.id)) void covers.ensure(props.asset.id)
})
</script>
<template>
  <div class="cover">
    <div v-if="asset.assetKind === 'model'" class="cover__status" :class="`cover__status--${status}`">
      <q-icon :name="statusIcon[status]" size="13px" /><span>{{ statusText }}</span>
    </div>
    <div
      v-if="asset.assetKind === 'model' && project.isSynchronized"
      class="cover__unity"
      :class="`cover__unity--${unity?.status ?? 'unlinked'}`"
      :title="
        unity?.projectAsset?.sceneUsageCount
          ? tr('unitySceneUsage', { count: unity.projectAsset.sceneUsageCount })
          : unity?.status
      "
    >
      <q-icon
        :name="
          unity?.projectAsset?.sceneUsageCount
            ? 'deployed_code'
            : unity?.status === 'linked'
              ? 'link'
              : unity?.status === 'ambiguous'
                ? 'warning'
                : 'link_off'
        "
        size="13px"
      />
    </div>
    <div v-if="project.duplicatesOf(asset.id).length" class="cover__duplicate" :title="t.duplicateContentFound">
      <q-icon name="content_copy" size="12px" />
    </div>
    <img v-if="src" :src="src" :alt="asset.name" />
    <div v-else class="cover__placeholder">{{ initial }}</div>
    <span class="cover__kind" :class="`cover__kind--${asset.assetKind}`">{{
      asset.assetKind === 'model' ? '3D' : 'PKG'
    }}</span
    ><button class="cover__favorite" @click="emit('favorite', $event)">
      <q-icon
        :name="asset.isFavorite ? 'star' : 'star_border'"
        :color="asset.isFavorite ? 'amber' : 'grey-5'"
        size="18px"
      />
    </button>
  </div>
</template>
<style scoped lang="scss">
@use '../../styles/variables' as *;
.cover {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  overflow: hidden;
  background: $color-divider;
}
.cover > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: $transition-slow;
}
.cover:hover > img {
  transform: scale(1.02);
}
.cover__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--placeholder-gradient);
  color: rgba(255, 255, 255, 0.9);
  font-size: 36px;
  font-weight: 700;
}
.cover__kind {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 2px 6px;
  border-radius: 4px;
  color: white;
  font-size: 9px;
  font-weight: 700;
}
.cover__kind--package {
  background: rgba(0, 122, 255, 0.8);
}
.cover__kind--model {
  background: rgba(230, 81, 0, 0.85);
}
.cover__favorite {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  opacity: 0;
}
.cover:hover .cover__favorite {
  opacity: 1;
}
.cover__status {
  position: absolute;
  z-index: 3;
  right: 8px;
  bottom: 8px;
  display: flex;
  gap: 3px;
  align-items: center;
  padding: 3px 6px;
  border-radius: 6px;
  background: rgba(52, 199, 89, 0.9);
  color: white;
  font-size: 9px;
  font-weight: 600;
}
.cover__status--pending {
  background: #ff9500;
}
.cover__status--failed {
  background: #ff3b30;
}
.cover__status--not-needed {
  background: #636366;
}
.cover__unity,
.cover__duplicate {
  position: absolute;
  z-index: 4;
  bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: white;
}
.cover__unity {
  left: 8px;
  background: #8e8e93;
}
.cover__unity--linked {
  background: #34c759;
}
.cover__unity--ambiguous {
  background: #ff9500;
}
.cover__unity--missing {
  background: #ff3b30;
}
.cover__duplicate {
  left: 38px;
  background: #af52de;
}
</style>
