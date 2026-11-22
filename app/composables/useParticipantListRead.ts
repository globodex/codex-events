import type { Ref, ShallowRef } from 'vue'

import type { AccountEventParticipantsPage } from '#shared/domains/events/account-event-participants-page'

import { watchDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { participantListStep } from '#shared/domains/events/account-event-page-registry'
import { isParticipantListCut } from '#shared/domains/events/account-event-participants-page'

// How long the viewer must stop typing before the search goes to the server.
const serverSearchDelayMs = 300

/** What the participant list request asks the server for. */
export interface ParticipantListRead {
  /** Search text the server answers. Empty for the list without a search. */
  searchText: string
  /** How many of the newest registrations the list asks for. "Load more" raises it. */
  rows: number
  /**
   * When the read was asked for. It is part of the request key, so a newly opened page, every
   * search and every "Load more" get an answer of their own. Without it, the list could show an
   * earlier answer again, from before a check-in.
   */
  askedAt: number
}

export function createParticipantListRead(read: { searchText?: string, rows?: number } = {}): ParticipantListRead {
  return {
    searchText: read.searchText ?? '',
    rows: read.rows ?? participantListStep,
    askedAt: Date.now()
  }
}

/**
 * Search and "Load more" of the participant list. Both change what the one list request asks the
 * server for (`serverRead`), so the list on screen is always one answer of the server.
 *
 * Search: the list always filters its loaded rows in the browser, at once. An event with more
 * registrations than the list holds is also searched on the server, shortly after the viewer
 * stops typing, so a search finds every registration. A smaller event sends no request.
 *
 * Load more: the list asks for one step more of the newest registrations.
 */
export function useParticipantListRead(list: {
  /** The loaded participant list, or null while there is none. */
  page: Ref<AccountEventParticipantsPage | null>
  /** True while the participant list request runs. */
  isReading: Ref<boolean>
  /** The read of the participant list request. A search or "Load more" replaces it. */
  serverRead: ShallowRef<ParticipantListRead>
}) {
  /** Text of the search box. */
  const searchText = ref('')

  const isListCut = computed(() =>
    list.page.value !== null && isParticipantListCut(list.page.value.pagination)
  )

  // `isListCut` is watched too, for a list that turns out to be cut after the text was typed.
  watchDebounced([searchText, isListCut], ([text]) => {
    const nextSearchText = text.trim()
    // A list that holds every registration is searched in the browser only. A search that the
    // server answered before is still changed or cleared on the server.
    const asksServer = isListCut.value || list.serverRead.value.searchText.length > 0

    if (asksServer && nextSearchText !== list.serverRead.value.searchText) {
      // The list keeps the number of rows it has loaded for when the search is cleared.
      list.serverRead.value = createParticipantListRead({
        searchText: nextSearchText,
        rows: list.serverRead.value.rows
      })
    }
  }, { debounce: serverSearchDelayMs })

  /** True while the server has not answered the typed search text yet. */
  const isSearching = computed(() => {
    const typedSearchText = searchText.value.trim()

    return isListCut.value
      && typedSearchText.length > 0
      && (typedSearchText !== list.serverRead.value.searchText || list.isReading.value)
  })

  /** True from "Load more" until the list request has finished. */
  const isLoadingMore = ref(false)

  /** Asks the server for one step more of the newest registrations. */
  function loadMore() {
    isLoadingMore.value = true
    list.serverRead.value = createParticipantListRead({
      searchText: list.serverRead.value.searchText,
      rows: list.serverRead.value.rows + participantListStep
    })
  }

  watch(list.isReading, (isReading) => {
    if (!isReading) {
      isLoadingMore.value = false
    }
  })

  return {
    isLoadingMore,
    isSearching,
    loadMore,
    searchText
  }
}
