import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { BridgeStatus } from '../platform/backend'
import { unityService } from '../services/unityService'

// Detection spawns PowerShell, so it runs on window focus and at a relaxed interval.
const REFRESH_INTERVAL_MS = 20_000
const CONNECT_POLL_MS = 1_000
const CONNECT_TIMEOUT_MS = 90_000

/** Which Unity project is open right now and whether its UnityPackHub bridge is running. */
export const useUnityConnectionStore = defineStore('unityConnection', () => {
  const projectPath = ref<string | null>(null)
  const status = ref<BridgeStatus>('offline')
  const checking = ref(false)
  const connecting = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  const projectName = computed(() => projectPath.value?.split(/[\\/]/).filter(Boolean).pop() ?? '')

  async function refresh(): Promise<void> {
    if (checking.value) return
    checking.value = true
    try {
      projectPath.value = await unityService.detectProject()
      status.value = projectPath.value ? await unityService.bridgeStatus(projectPath.value) : 'offline'
    } finally {
      checking.value = false
    }
  }

  /** Installs or updates the bridge, then waits until Unity has compiled and loaded it. */
  async function connect(): Promise<BridgeStatus> {
    if (!projectPath.value || connecting.value) return status.value
    const project = projectPath.value
    connecting.value = true
    try {
      await unityService.installBridge(project)
      const deadline = Date.now() + CONNECT_TIMEOUT_MS
      while (Date.now() < deadline) {
        status.value = await unityService.bridgeStatus(project)
        if (status.value === 'ready') break
        await new Promise((resolve) => setTimeout(resolve, CONNECT_POLL_MS))
      }
      return status.value
    } finally {
      connecting.value = false
    }
  }

  const onFocus = () => { void refresh() }

  function startMonitoring(): void {
    if (timer) return
    void refresh()
    timer = setInterval(() => { void refresh() }, REFRESH_INTERVAL_MS)
    window.addEventListener('focus', onFocus)
  }

  function stopMonitoring(): void {
    if (timer) clearInterval(timer)
    timer = null
    window.removeEventListener('focus', onFocus)
  }

  return { projectPath, projectName, status, checking, connecting, refresh, connect, startMonitoring, stopMonitoring }
})
