import { computed, ref } from "vue";
import { exists } from "@tauri-apps/plugin-fs";
import type { Asset } from "../types/asset";
import {
  commands,
  type AssetMetadata,
  type RelatedFile,
} from "../services/tauriCommands";
export type ModelFileFilter =
  "all" | "texture" | "material" | "model" | "prefab";
export function useModelShowcase(asset: () => Asset) {
  const files = ref<RelatedFile[]>([]);
  const metadata = ref<AssetMetadata | null>(null);
  const loading = ref(false);
  const open = ref(false);
  const filter = ref<ModelFileFilter>("all");
  const filtered = computed(() =>
    filter.value === "all"
      ? files.value
      : files.value.filter((file) => file.fileType === filter.value),
  );
  const counts = computed(() =>
    files.value.reduce<Record<string, number>>(
      (value, file) => {
        value[file.fileType] = (value[file.fileType] ?? 0) + 1;
        return value;
      },
      { all: files.value.length },
    ),
  );
  async function loadMetadata() {
    const path = asset().filePath;
    const normalized = path.replace(/\\/g, "/");
    const dir = path.slice(0, normalized.lastIndexOf("/"));
    for (const name of [
      "asset_metadata.json",
      "metadata.json",
      "model_metadata.json",
    ]) {
      const candidate = `${dir}${dir.includes("\\") ? "\\" : "/"}${name}`;
      if (await exists(candidate)) {
        metadata.value = await commands.readAssetMetadata(candidate, path);
        if (metadata.value) return;
      }
    }
  }
  async function toggle() {
    if (open.value) {
      open.value = false;
      return;
    }
    if (!files.value.length) {
      loading.value = true;
      try {
        const [result] = await Promise.all([
          commands.scanModelRelatedFiles(asset().filePath),
          loadMetadata(),
        ]);
        files.value = result;
      } finally {
        loading.value = false;
      }
    }
    open.value = true;
  }
  function reset() {
    files.value = [];
    metadata.value = null;
    loading.value = false;
    open.value = false;
    filter.value = "all";
  }
  return {
    files,
    metadata,
    loading,
    open,
    filter,
    filtered,
    counts,
    toggle,
    reset,
  };
}
