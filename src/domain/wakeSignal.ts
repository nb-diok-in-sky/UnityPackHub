/**
 * Lets a loop sleep until something happens: `wait` resolves on the next `notify`, or after the
 * timeout as a safety net in case an event never arrives. A `notify` with nobody waiting is
 * remembered, so an event that lands between two checks is not lost.
 */
export function createWakeSignal() {
  let wake: (() => void) | null = null
  let pending = false

  return {
    notify(): void {
      if (wake) wake()
      else pending = true
    },
    wait(timeoutMs: number): Promise<void> {
      if (pending) {
        pending = false
        return Promise.resolve()
      }
      return new Promise((resolve) => {
        const timer = setTimeout(done, Math.max(0, timeoutMs))
        function done(): void {
          clearTimeout(timer)
          wake = null
          resolve()
        }
        wake = done
      })
    },
  }
}
