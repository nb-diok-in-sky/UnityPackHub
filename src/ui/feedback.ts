// User-facing notifications and confirmations. The only place that imports Quasar plugins.
import { Dialog, Notify } from 'quasar'

export const notify = {
  success: (message: string) => Notify.create({ type: 'positive', message }),
  info: (message: string) => Notify.create({ type: 'info', message }),
  warning: (message: string) => Notify.create({ type: 'warning', message, timeout: 6000 }),
  error: (message: string) => Notify.create({ type: 'negative', message, timeout: 6000 }),
  /** Confirmation with one action button, e.g. "Undo" after removing assets. */
  withAction: (message: string, actionLabel: string, action: () => void) =>
    Notify.create({
      message,
      timeout: 6000,
      actions: [{ label: actionLabel, color: 'yellow', handler: action }],
    }),
}

export function confirm(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Dialog.create({ title, message, cancel: true, persistent: true })
      .onOk(() => resolve(true))
      .onCancel(() => resolve(false))
  })
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
