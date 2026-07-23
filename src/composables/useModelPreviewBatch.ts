import { computed, ref, watch } from "vue";
import { useAssetStore } from "../stores/assetStore";
import { useSettingsStore } from "../stores/settingsStore";
import { commands } from "../services/tauriCommands";
import {
  cancelModelPreviewGeneration,
  needsModelPreview,
  startModelPreviewGeneration,
  type ModelPreviewProgress,
} from "../services/modelPreviewService";

export function useModelPreviewBatch() {
  const assets = useAssetStore();
  const settings = useSettingsStore();
  const running = ref(false);
  const dialogOpen = ref(false);
  const limit = ref(20);
  const currentViewOnly = ref(true);
  const progress = ref<ModelPreviewProgress | null>(null);
  const missing = computed(() => assets.assets.filter(needsModelPreview));
  const currentView = computed(() =>
    assets.filteredAssets.filter(needsModelPreview),
  );
  const candidates = computed(() =>
    currentViewOnly.value ? currentView.value : missing.value,
  );
  watch(
    () => missing.value.length,
    (count) => {
      limit.value = Math.min(Math.max(1, limit.value), Math.max(1, count));
    },
    { immediate: true },
  );
  function open() {
    if (missing.value.length) {
      currentViewOnly.value = true;
      limit.value = Math.min(20, Math.max(1, currentView.value.length));
      dialogOpen.value = true;
    }
  }
  async function start() {
    if (running.value) return;
    let editor =
      settings.settings.unityEditorPath ||
      (await commands.discoverUnityEditors())[0] ||
      "";
    if (!editor) return;
    if (!settings.settings.unityEditorPath)
      await settings.setUnityEditorPath(editor);
    running.value = true;
    try {
      await startModelPreviewGeneration(
        editor,
        candidates.value,
        limit.value,
        (value) => {
          progress.value = value;
        },
      );
    } finally {
      running.value = false;
    }
  }
  async function cancel() {
    if (running.value) await cancelModelPreviewGeneration();
  }
  return {
    running,
    dialogOpen,
    limit,
    currentViewOnly,
    progress,
    missing,
    currentView,
    candidates,
    open,
    start,
    cancel,
  };
}
