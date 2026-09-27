import { computed, ref } from 'vue'
import { needsModelPreview } from '../domain/modelCover'
import { useBrowseStore } from '../stores/browseStore'
import { useModelCoverStore } from '../stores/modelCoverStore'
import { useI18n } from '../i18n'
import { notify } from '../ui/feedback'

const DEFAULT_LIMIT = 20

/** State of the "generate model covers" dialog. */
export function useModelPreviewBatch() {
  const browse = useBrowseStore()
  const job = useModelCoverStore()
  const { t } = useI18n()
  const dialogOpen = ref(false)
  const limit = ref(DEFAULT_LIMIT)
  const currentViewOnly = ref(true)

  const missing = computed(() => browse.libraryAssets.filter(needsModelPreview))
  const currentView = computed(() => browse.visibleAssets.filter(needsModelPreview))
  const candidates = computed(() => (currentViewOnly.value ? currentView.value : missing.value))

  function open(): void {
    if (missing.value.length === 0) {
      notify.info(t.modelCoverNothingMissing)
      return
    }
    // Default to the current view only when it actually has something to render.
    currentViewOnly.value = currentView.value.length > 0
    limit.value = Math.min(DEFAULT_LIMIT, candidates.value.length)
    dialogOpen.value = true
  }

  return {
    job,
    dialogOpen,
    limit,
    currentViewOnly,
    missing,
    currentView,
    candidates,
    open,
    start: () => job.start(candidates.value, limit.value),
  }
}
