/**
 * Search rule of the participant list.
 *
 * The browser uses it for the registrations it has loaded, and the server uses it for all
 * registrations of an event. Both must find the same people, so the rule lives here once.
 */

/**
 * Removes accents and letter case from a text, so "Öztürk", "OZTURK" and "ozturk" all become
 * "ozturk".
 */
export function normalizeParticipantSearchText(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    // Splits an accented letter into the plain letter and its accent marks.
    .normalize('NFKD')
    // Removes the accent marks.
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/** True when at least one of the values contains the search text. */
export function participantSearchTextMatches(
  values: Array<string | null | undefined>,
  searchText: string
) {
  const normalizedSearchText = normalizeParticipantSearchText(searchText)

  return values.some(value => normalizeParticipantSearchText(value).includes(normalizedSearchText))
}
