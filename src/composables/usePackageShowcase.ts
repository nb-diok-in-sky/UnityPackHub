import { computed, ref } from "vue";
import type { Asset } from "../types/asset";
import {
  clearShowcaseCache,
  parsePackageAssets,
  type PackageAssetEntry,
  type PackageAssetList,
} from "../services/coverFetcher";
import { commands } from "../services/tauriCommands";
import { getPackagePreviewKey } from "../services/packagePreviewIdentity";
import {
  getPackagePreviewFileName,
  type PackagePreviewRequest,
} from "../services/packagePreviewFile";

export const PACKAGE_SHOWCASE_TYPES = ["Prefab", "Texture", "Script"] as const;
export type PackageShowcaseType = (typeof PACKAGE_SHOWCASE_TYPES)[number];

export function usePackageShowcase(asset: () => Asset) {
  const data = ref<PackageAssetList | null>(null);
  const loading = ref(false);
  const open = ref(false);
  const filter = ref<"All" | PackageShowcaseType>("All");
  const previewImages = ref<Map<string, string>>(new Map());

  const entries = computed(
    () =>
      data.value?.entries.filter((entry) =>
        PACKAGE_SHOWCASE_TYPES.includes(
          entry.asset_type as PackageShowcaseType,
        ),
      ) ?? [],
  );
  const filteredEntries = computed(() =>
    filter.value === "All"
      ? entries.value
      : entries.value.filter((entry) => entry.asset_type === filter.value),
  );
  const typeCounts = computed(() =>
    Object.fromEntries(
      ["All", ...PACKAGE_SHOWCASE_TYPES].map((type) => [
        type,
        type === "All"
          ? entries.value.length
          : entries.value.filter((entry) => entry.asset_type === type).length,
      ]),
    ),
  );

  function thumbnail(entry: PackageAssetEntry): string | null {
    if (entry.asset_type === "Prefab")
      return (
        previewImages.value.get(getPackagePreviewFileName(entry.pathname)) ??
        null
      );
    return entry.preview;
  }

  async function load(force = false): Promise<void> {
    loading.value = true;
    try {
      if (force) await clearShowcaseCache(asset().filePath);
      data.value = await parsePackageAssets(asset().filePath);
      const requests: PackagePreviewRequest[] =
        data.value?.entries
          .filter((entry) => entry.asset_type === "Prefab")
          .map(({ pathname, filename }) => ({ pathname, filename })) ?? [];
      const directory = await commands.ensurePreviewDir(
        getPackagePreviewKey(asset().filePath),
        requests,
      );
      previewImages.value = directory.existing_files.length
        ? new Map(
            Object.entries(await commands.readAllPreviews(directory.path)),
          )
        : new Map();
    } finally {
      loading.value = false;
    }
  }

  async function toggle(): Promise<void> {
    if (open.value) {
      open.value = false;
      return;
    }
    if (!data.value) await load();
    open.value = true;
  }

  async function clearPreviews(): Promise<void> {
    await commands.clearAllPreviews();
    reset();
  }

  function reset(): void {
    data.value = null;
    loading.value = false;
    open.value = false;
    filter.value = "All";
    previewImages.value = new Map();
  }

  return {
    data,
    loading,
    open,
    filter,
    entries,
    filteredEntries,
    typeCounts,
    thumbnail,
    load,
    toggle,
    clearPreviews,
    reset,
  };
}
