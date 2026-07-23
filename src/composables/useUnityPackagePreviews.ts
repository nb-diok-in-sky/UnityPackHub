import { ref } from "vue";
import type { Asset } from "../types/asset";
import {
  getPackagePreviews,
  readPreviewImage,
  type PackagePreviews,
  type PreviewEntry,
} from "../services/unityImporter";
import { getPackagePreviewKey } from "../services/packagePreviewIdentity";
import { useAssetStore } from "../stores/assetStore";
export function useUnityPackagePreviews(asset: () => Asset) {
  const assets = useAssetStore();
  const data = ref<PackagePreviews | null>(null);
  const loading = ref(false);
  const images = ref<Record<string, string>>({});
  const selected = ref<PreviewEntry | null>(null);
  async function load() {
    loading.value = true;
    try {
      data.value = await getPackagePreviews(
        getPackagePreviewKey(asset().filePath),
      );
      const values: Record<string, string> = {};
      if (data.value)
        for (const entry of data.value.entries) {
          const image = await readPreviewImage(
            data.value.preview_dir,
            entry.preview,
          );
          if (image) values[entry.preview] = image;
        }
      images.value = values;
    } finally {
      loading.value = false;
    }
  }
  async function useAsCover(entry: PreviewEntry) {
    if (!data.value) return;
    const image =
      images.value[entry.preview] ??
      (await readPreviewImage(data.value.preview_dir, entry.preview));
    if (image) await assets.updateAsset(asset().id, { thumbnailPath: image });
  }
  function reset() {
    data.value = null;
    loading.value = false;
    images.value = {};
    selected.value = null;
  }
  return { data, loading, images, selected, load, useAsCover, reset };
}
