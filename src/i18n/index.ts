import { reactive, ref, watchEffect } from 'vue'
import { enUS } from './locales/en-US'
import { zhCN } from './locales/zh-CN'

export type Locale = 'zh-CN' | 'en-US'
export type TranslationKey = keyof typeof zhCN

const translations: Record<Locale, Record<TranslationKey, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
}
const currentLocale = ref<Locale>('zh-CN')
const t = reactive<Record<TranslationKey, string>>({ ...zhCN })

watchEffect(() => {
  Object.assign(t, translations[currentLocale.value])
})

export function useI18n() {
  function setLocale(locale: Locale): void {
    currentLocale.value = locale
  }

  function tr(key: TranslationKey, params?: Record<string, string | number>): string {
    let text = translations[currentLocale.value][key]
    for (const [name, value] of Object.entries(params ?? {})) {
      text = text.replace(`{${name}}`, String(value))
    }
    return text
  }

  return { locale: currentLocale, t, tr, setLocale }
}
