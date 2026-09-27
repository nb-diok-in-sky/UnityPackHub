import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Asset } from '../types/asset'
import { isPermanentRenderFailure, needsModelPreview } from '../domain/modelCover'
import { modelPreviewService, type ModelCoverOutcome } from '../services/modelPreviewService'
import { unityService } from '../services/unityService'
import { useI18n } from '../i18n'
import { errorMessage, notify } from '../ui/feedback'
import { useAssetStore } from './assetStore'
import { useSettingsStore } from './settingsStore'

export interface ModelCoverProgress {
  total: number
  completed: number
  succeeded: number
  failed: number
}

/** The batch job that renders missing model covers with a headless Unity. */
export const useModelCoverStore = defineStore('modelCovers', () => {
  const running = ref(false)
  const progress = ref<ModelCoverProgress | null>(null)
  let cancelled = false
  const { tr } = useI18n()

  async function resolveEditor(): Promise<string | null> {
    const settings = useSettingsStore()
    if (settings.settings.unityEditorPath) return settings.settings.unityEditorPath
    const [editor] = await unityService.discoverEditors()
    if (editor) await settings.setUnityEditorPath(editor)
    return editor ?? null
  }

  async function apply(outcome: ModelCoverOutcome): Promise<void> {
    const assets = useAssetStore()
    const asset = assets.byId.get(outcome.assetId)
    const counters = progress.value
    if (!asset || !counters) return
    counters.completed++
    if ('image' in outcome) {
      await assets.setCover(asset, outcome.image)
      counters.succeeded++
      return
    }
    counters.failed++
    const previous = asset.modelPreview ?? { version: 0, error: '', eligible: true }
    await assets.patch(asset.id, {
      modelPreview: { ...previous, error: outcome.error, eligible: previous.eligible && !isPermanentRenderFailure(outcome.error) },
    })
  }

  async function start(candidates: Asset[], limit: number): Promise<void> {
    if (running.value) return
    const editorPath = await resolveEditor()
    if (!editorPath) {
      notify.warning(tr('unityEditorNotFound'))
      return
    }
    const models = candidates.filter(needsModelPreview).slice(0, Math.max(0, limit))
    running.value = true
    cancelled = false
    progress.value = { total: models.length, completed: 0, succeeded: 0, failed: 0 }
    try {
      await modelPreviewService.run({
        editorPath,
        models,
        shaderRulesPath: useSettingsStore().settings.shaderAdapters.rulesPath,
        onOutcome: apply,
        isCancelled: () => cancelled,
      })
      const { succeeded, failed } = progress.value
      ;(failed ? notify.warning : notify.success)(tr('modelCoverDone', { succeeded, failed }))
    } catch (error) {
      notify.error(tr('modelCoverRunFailed', { reason: errorMessage(error) }))
    } finally {
      running.value = false
    }
  }

  async function cancel(): Promise<void> {
    if (!running.value) return
    cancelled = true
    await modelPreviewService.cancel()
  }

  return { running, progress, start, cancel }
})
