import { describe, expect, it, vi } from 'vitest'
import { createWakeSignal } from '../src/domain/wakeSignal'

describe('createWakeSignal', () => {
  it('wakes a waiting loop on notify', async () => {
    const signal = createWakeSignal()
    const waited = signal.wait(60_000)
    signal.notify()
    await expect(waited).resolves.toBeUndefined()
  })

  it('remembers a notify that arrived before the wait', async () => {
    vi.useFakeTimers()
    try {
      const signal = createWakeSignal()
      signal.notify()
      let woke = false
      void signal.wait(60_000).then(() => {
        woke = true
      })
      await vi.advanceTimersByTimeAsync(0)
      expect(woke).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back to the timeout when no event comes', async () => {
    vi.useFakeTimers()
    try {
      const signal = createWakeSignal()
      let woke = false
      void signal.wait(1000).then(() => {
        woke = true
      })
      await vi.advanceTimersByTimeAsync(999)
      expect(woke).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(woke).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
