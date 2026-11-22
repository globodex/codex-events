import type { MaybeRefOrGetter, MultiWatchSources } from 'vue'
import { isRef, toValue } from 'vue'

import { isAbortError } from '~/lib/request-cancellation'

const defaultMaxSettledEntries = 32

interface ProtectedRequestEntry<T> {
  controller: AbortController
  promise: Promise<T>
  settled: boolean
  subscribers: Set<symbol>
}

export interface ProtectedRequestExecuteOptions {
  force?: boolean
}

export interface ProtectedRequestOwner {
  keys(): IterableIterator<string>
  execute<T>(
    key: string,
    signal: AbortSignal | undefined,
    load: (signal: AbortSignal) => Promise<T>,
    options?: ProtectedRequestExecuteOptions
  ): Promise<T>
  invalidate(key: string): void
}

export interface ProtectedRequestOwnerOptions {
  maxSettledEntries?: number
}

function stableRequestPart(value: unknown, stack = new Set<object>()): string {
  if (value === undefined) {
    return 'undefined'
  }

  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? 'NaN' : JSON.stringify(value)
  }

  if (typeof value === 'bigint') {
    return `${value}n`
  }

  if (typeof value === 'symbol') {
    return value.toString()
  }

  if (typeof value === 'function') {
    return `[Function:${value.name || 'anonymous'}]`
  }

  if (stack.has(value)) {
    return '[Circular]'
  }

  stack.add(value)

  let result: string
  if (Array.isArray(value)) {
    result = `[${value.map(item => stableRequestPart(item, stack)).join(',')}]`
  } else if (value instanceof Date) {
    result = `Date:${value.toISOString()}`
  } else if (typeof Headers !== 'undefined' && value instanceof Headers) {
    result = `Headers:${stableRequestPart(Array.from(value.entries()), stack)}`
  } else if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) {
    result = `URLSearchParams:${stableRequestPart(Array.from(value.entries()), stack)}`
  } else {
    result = `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableRequestPart(value[key as keyof typeof value], stack)}`)
      .join(',')}}`
  }

  stack.delete(value)
  return result
}

export function resolveProtectedWatchSources(
  watchSources: MultiWatchSources | false | undefined
) {
  if (watchSources === false || watchSources === undefined) {
    return []
  }

  return watchSources.map((source) => {
    if (isRef(source) || typeof source === 'function') {
      return toValue(source as MaybeRefOrGetter<unknown>)
    }

    return source
  })
}

export function buildProtectedRequestKey(...parts: unknown[]) {
  return stableRequestPart(parts.length === 1 ? parts[0] : parts)
}

function isSettledError(error: unknown, signal: AbortSignal) {
  // A non-abort outcome is a settlement. Transport failures are retained too:
  // a lifecycle, watcher, or remount must not turn a failed protected read
  // into an implicit retry. Explicit refresh/invalidation owns retry intent.
  return !isAbortError(error, signal)
}

export function createProtectedRequestOwner(
  options: ProtectedRequestOwnerOptions = {}
): ProtectedRequestOwner {
  const entries = new Map<string, ProtectedRequestEntry<unknown>>()
  const maxSettledEntries = Math.max(
    0,
    Math.floor(options.maxSettledEntries ?? defaultMaxSettledEntries)
  )

  function trimSettledEntries() {
    let retainedSettledEntries = 0

    for (const entry of entries.values()) {
      if (entry.settled) {
        retainedSettledEntries += 1
      }
    }

    if (retainedSettledEntries <= maxSettledEntries) {
      return
    }

    for (const [key, entry] of entries) {
      if (retainedSettledEntries <= maxSettledEntries) {
        break
      }

      if (!entry.settled || entry.subscribers.size > 0) {
        continue
      }

      entries.delete(key)
      retainedSettledEntries -= 1
    }
  }

  function abortEntry(key: string, entry: ProtectedRequestEntry<unknown>) {
    if (entries.get(key) !== entry) {
      return
    }

    entries.delete(key)
    entry.controller.abort()
  }

  function start<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
    const controller = new AbortController()
    const entry = {
      controller,
      promise: undefined as unknown as Promise<T>,
      settled: false,
      subscribers: new Set<symbol>()
    }
    entry.promise = Promise.resolve()
      .then(() => load(controller.signal))
      .then(
        (value) => {
          if (entries.get(key) === entry) {
            entry.settled = true
            trimSettledEntries()
          }

          return value
        },
        (error) => {
          if (entries.get(key) === entry) {
            if (isSettledError(error, controller.signal)) {
              entry.settled = true
              trimSettledEntries()
            } else {
              entries.delete(key)
            }
          }

          throw error
        }
      )

    entries.set(key, entry)

    return entry
  }

  function subscribe<T>(
    key: string,
    entry: ProtectedRequestEntry<T>,
    signal: AbortSignal | undefined
  ) {
    const subscriber = Symbol(key)

    return new Promise<T>((resolve, reject) => {
      let completed = false

      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort)
        entry.subscribers.delete(subscriber)
        trimSettledEntries()
      }
      const onAbort = () => {
        if (completed) {
          return
        }

        completed = true
        cleanup()

        if (!entry.settled && entry.subscribers.size === 0) {
          abortEntry(key, entry)
        }

        reject(new DOMException('The request was aborted.', 'AbortError'))
      }

      entry.subscribers.add(subscriber)

      if (signal?.aborted) {
        onAbort()
        return
      }

      signal?.addEventListener('abort', onAbort, { once: true })
      void entry.promise.then(
        (value) => {
          if (completed) {
            return
          }

          completed = true
          cleanup()
          resolve(value)
        },
        (error) => {
          if (completed) {
            return
          }

          completed = true
          cleanup()
          reject(error)
        }
      )
    })
  }

  return {
    keys: () => entries.keys(),
    execute<T>(
      key: string,
      signal: AbortSignal | undefined,
      load: (signal: AbortSignal) => Promise<T>,
      options?: ProtectedRequestExecuteOptions
    ) {
      let entry = entries.get(key) as ProtectedRequestEntry<T> | undefined

      if (options?.force && entry) {
        abortEntry(key, entry)
        entry = undefined
      }

      if (!entry) {
        entry = start(key, load)
      } else if (entry.settled) {
        entries.delete(key)
        entries.set(key, entry)
      }

      return subscribe(key, entry, signal)
    },

    invalidate(key) {
      const entry = entries.get(key)

      if (!entry) {
        return
      }

      abortEntry(key, entry)
    }
  }
}

const protectedRequestOwners = new WeakMap<object, ProtectedRequestOwner>()

export function useProtectedRequestOwner() {
  const nuxtApp = useNuxtApp()
  const existing = protectedRequestOwners.get(nuxtApp)

  if (existing) {
    return existing
  }

  const owner = createProtectedRequestOwner()
  protectedRequestOwners.set(nuxtApp, owner)
  return owner
}
