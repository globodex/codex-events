import { computed, ref, shallowReactive, watch, type Ref } from 'vue'

import type { ApiDataResponse } from '~/lib/api'
import { moveListItemByIndex } from '~/utils/reorder-list'
import { useApiClient } from '~/composables/useApiClient'

/** One row of an ordered list that an event owns, for example a judging criterion or a prize. */
export interface EventCatalogRow {
  id: string
  eventId: string
  createdAt: string
  displayOrder: number
}

/** Numbers the rows from 1 in their current order. */
export function applyCatalogDisplayOrder(rows: { displayOrder: number }[]) {
  rows.forEach((row, index) => {
    row.displayOrder = index + 1
  })
}

/** Moves one row to another position and numbers the rows again. */
export function moveCatalogRow(rows: { displayOrder: number }[], from: number, to: number) {
  applyCatalogDisplayOrder(moveListItemByIndex(rows, from, to))
}

/**
 * The draft of one ordered list of an event: the judging criteria or the prizes.
 *
 * The organizer edits `rows`. `save` then sends only what differs from the saved list: it
 * deletes the removed rows, creates the new rows and updates the changed rows, one request
 * per row. When a request fails, the rows that were already written stay written, so a second
 * save sends only the rest.
 */
export function useEventCatalogDraft<T extends EventCatalogRow>(options: {
  eventId: () => string
  resource: 'evaluation-criteria' | 'prizes'
  /** The saved rows of the event. */
  source: () => T[]
  /** Called after a save wrote at least one row, also when a later row failed. */
  onSaved: () => void
}) {
  const apiFetch = useApiClient()
  const rows = ref([]) as Ref<T[]>
  const saved = shallowReactive(new Map<string, T>())
  const removed = computed(() => {
    const ids = new Set(rows.value.map(row => row.id))
    return [...saved.keys()].filter(id => !ids.has(id))
  })
  const edited = computed(() => rows.value.filter((row) => {
    const original = saved.get(row.id)
    return !original || (Object.keys(row) as (keyof T)[]).some(key => row[key] !== original[key])
  }))
  const hasChanges = computed(() => removed.value.length > 0 || edited.value.length > 0)

  // The saved rows replace the draft only while the draft has no change of its own.
  watch(options.source, (savedRows) => {
    if (hasChanges.value) return
    saved.clear()
    for (const row of savedRows) saved.set(row.id, row)
    rows.value = savedRows.map(row => ({ ...row }))
  }, { immediate: true })

  async function save() {
    const path = `/api/events/${options.eventId()}/${options.resource}`
    let wrote = false
    try {
      for (const id of removed.value) {
        await apiFetch(`${path}/${id}`, { method: 'DELETE' })
        saved.delete(id)
        wrote = true
      }

      // Criteria require unique positions. Free occupied positions before swapping rows.
      if (options.resource === 'evaluation-criteria') {
        const requested = new Set(rows.value.map(row => row.displayOrder))
        let temporaryOrder = Math.max(0, ...requested, ...[...saved.values()].map(row => row.displayOrder))
        for (const row of edited.value) {
          const original = saved.get(row.id)
          if (original && original.displayOrder !== row.displayOrder && requested.has(original.displayOrder)) {
            const { data } = await apiFetch<ApiDataResponse<T>>(`${path}/${row.id}`, {
              method: 'PATCH', body: { displayOrder: ++temporaryOrder }
            })
            saved.set(data.id, data)
            wrote = true
          }
        }
      }

      for (const row of edited.value) {
        const { id, eventId: _eventId, createdAt: _createdAt, ...body } = row
        const exists = saved.has(id)
        const { data } = await apiFetch<ApiDataResponse<T>>(exists ? `${path}/${id}` : path, {
          method: exists ? 'PATCH' : 'POST', body
        })
        saved.set(data.id, data)
        Object.assign(row, data)
        wrote = true
      }
    } finally {
      if (wrote) options.onSaved()
    }
  }

  return { rows, hasChanges, save }
}
