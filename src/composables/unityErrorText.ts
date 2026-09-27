import { useI18n, type TranslationKey } from '../i18n'
import { UnityError, type UnityActionError } from '../services/unityService'
import { errorMessage } from '../ui/feedback'

const MESSAGES: Record<UnityActionError, TranslationKey> = {
  'no-project': 'unityNoProject',
  'bridge-offline': 'unityBridgeOffline',
  'bridge-outdated': 'unityBridgeOutdated',
  timeout: 'unityTimeout',
}

/** Human-readable text for failures of Unity editor actions. */
export function unityErrorText(error: unknown): string {
  const { t } = useI18n()
  if (error instanceof UnityError && error.reason !== 'unity') return t[MESSAGES[error.reason]]
  return errorMessage(error)
}
