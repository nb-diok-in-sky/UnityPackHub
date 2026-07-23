import { ref, watch, type Ref } from 'vue'
import { open } from '@tauri-apps/plugin-shell'
import type { Asset } from '../types/asset'
import { setAssetCoverFromBlob } from '../services/assetCoverService'
import {
  assetStoreSearchUrl,
  downloadAssetStoreCover,
  getRememberedAssetStoreLink,
  rememberAssetStoreLink,
  resolveAssetStoreProduct,
  type AssetStoreProduct,
} from '../services/unityAssetStoreClient'

export function useOfficialCover(asset: Ref<Asset>) {
  const dialogOpen = ref(false)
  const productUrl = ref('')
  const product = ref<AssetStoreProduct | null>(null)
  const loading = ref(false)
  const error = ref('')

  watch(
    () => asset.value.id,
    () => {
      dialogOpen.value = false
      productUrl.value = ''
      product.value = null
      error.value = ''
    },
  )

  async function openDialog(): Promise<void> {
    dialogOpen.value = true
    error.value = ''
    product.value = await getRememberedAssetStoreLink(asset.value.id)
    productUrl.value = product.value?.productUrl ?? ''
  }

  async function openSearch(): Promise<void> {
    await open(assetStoreSearchUrl(asset.value.name))
  }

  async function resolveProduct(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      product.value = await resolveAssetStoreProduct(productUrl.value)
    } catch (reason) {
      product.value = null
      error.value = reason instanceof Error ? reason.message : String(reason)
    } finally {
      loading.value = false
    }
  }

  async function applyCover(): Promise<void> {
    if (!product.value) return
    loading.value = true
    error.value = ''
    try {
      await setAssetCoverFromBlob(asset.value, await downloadAssetStoreCover(product.value))
      await rememberAssetStoreLink(asset.value.id, product.value)
      dialogOpen.value = false
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : String(reason)
    } finally {
      loading.value = false
    }
  }

  return { dialogOpen, productUrl, product, loading, error, openDialog, openSearch, resolveProduct, applyCover }
}
