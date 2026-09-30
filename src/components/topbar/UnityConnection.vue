<script setup lang="ts">
import { computed } from 'vue'
import { useUnityConnectionStore } from '../../stores/unityConnectionStore'
import { useI18n } from '../../i18n'
import { notify } from '../../ui/feedback'

const unity = useUnityConnectionStore()
const { t } = useI18n()

const state = computed(() => {
  if (!unity.projectPath) return { color: 'grey', label: t.unityNotRunning, detail: t.unityNotRunningHint }
  if (unity.status === 'ready') return { color: 'positive', label: unity.projectName, detail: t.unityBridgeReady }
  if (unity.status === 'outdated') return { color: 'warning', label: unity.projectName, detail: t.unityBridgeOutdatedStatus }
  return { color: 'warning', label: unity.projectName, detail: t.unityBridgeNotLoaded }
})

async function connect(): Promise<void> {
  const status = await unity.connect()
  if (status === 'ready') notify.success(t.unityBridgeReady)
  else notify.warning(t.unityConnectTimeout)
}
</script>

<template>
  <q-btn flat dense no-caps size="sm" class="unity-connection" :title="state.detail">
    <span class="unity-connection__dot" :class="`bg-${state.color}`" />
    <q-icon name="sports_esports" size="16px" class="q-mr-xs" />
    <span class="unity-connection__label">{{ state.label }}</span>
    <q-menu anchor="bottom right" self="top right">
      <q-card class="unity-connection__card">
        <q-card-section>
          <div class="text-subtitle2">{{ unity.projectName || t.unityNotRunning }}</div>
          <div v-if="unity.projectPath" class="unity-connection__path">{{ unity.projectPath }}</div>
          <div class="unity-connection__detail">{{ state.detail }}</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat dense no-caps icon="refresh" :label="t.refresh" :loading="unity.checking" @click="unity.refresh" />
          <q-btn
            v-if="unity.projectPath && unity.status !== 'ready'"
            unelevated dense no-caps color="primary" icon="link"
            :label="t.unityConnect" :loading="unity.connecting" @click="connect"
          />
        </q-card-actions>
      </q-card>
    </q-menu>
  </q-btn>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;
.unity-connection { max-width: 200px; color: $color-secondary; }
.unity-connection__dot { width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; flex-shrink: 0; }
.unity-connection__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.unity-connection__card { width: 300px; }
.unity-connection__path { margin-top: 2px; color: $color-secondary; font-size: 11px; word-break: break-all; }
.unity-connection__detail { margin-top: 8px; font-size: 12px; }
</style>
