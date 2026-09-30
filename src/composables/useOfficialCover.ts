import { ref, watch, type Ref } from 'vue'
import type { Asset, AssetStoreProduct } from '../types/asset'
import { assetStoreSearchUrl } from '../domain/assetStore'
import { AssetStoreError, assetStoreService } from '../services/assetStoreService'
import { coverService } from '../services/coverService'
import { fileService } from '../services/fileService'
import { useAssetStore } from '../stores/assetStore'
import { useI18n } from '../i18n'
import { errorMessage } from '../ui/feedback'

/** "Official cover" dialog: link an Asset Store product page and use its cover image. */
export function useOfficialCover(asset: Ref<Asset>) {
  const assets = useAssetStore()
  const { t, tr } = useI18n()
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

  function describe(reason: unknown): string {
    if (!(reason instanceof AssetStoreError)) return errorMessage(reason)
    if (reason.reason === 'invalid-url') return t.assetStoreInvalidUrl
    if (reason.reason === 'no-cover') return t.assetStoreNoCover
    return tr('assetStoreRequestFailed', { status: reason.status ?? 0 })
  }

  async function run(action: () => Promise<void>): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      await action()
    } catch (reason) {
      error.value = describe(reason)
    } finally {
      loading.value = false
    }
  }

  return {
    dialogOpen,
    productUrl,
    product,
    loading,
    error,
    async openDialog(): Promise<void> {
      dialogOpen.value = true
      error.value = ''
      product.value = await assetStoreService.remembered(asset.value.id)
      productUrl.value = product.value?.productUrl ?? ''
    },
    openSearch: () => fileService.openUrl(assetStoreSearchUrl(asset.value.name)),
    resolveProduct: () =>
      run(async () => {
        product.value = null
        product.value = await assetStoreService.resolveProduct(productUrl.value)
      }),
    applyCover: () =>
      run(async () => {
        if (!product.value) return
        await assets.setCover(asset.value, await coverService.imageFromUrl(product.value.imageUrl))
        await assetStoreService.remember(asset.value.id, product.value)
        dialogOpen.value = false
      }),
  }
}
