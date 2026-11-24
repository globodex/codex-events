import type { LocationQueryValue } from 'vue-router'

function getFirstQueryValue(value: LocationQueryValue | LocationQueryValue[] | null | undefined) {
  if (value === null || value === undefined) {
    return null
  }

  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value
}

export function normalizeTabQueryValue(value: LocationQueryValue | LocationQueryValue[] | null | undefined) {
  const firstValue = getFirstQueryValue(value)

  if (typeof firstValue !== 'string') {
    return null
  }

  const normalized = firstValue.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

/** The session that a link to the Agenda tab names: a session id, or `first`. */
export function normalizeSessionQueryValue(value: LocationQueryValue | LocationQueryValue[] | null | undefined) {
  const firstValue = getFirstQueryValue(value)?.trim()

  return firstValue ? firstValue : null
}

export function resolveTabQueryValue<TTab extends string>(
  value: LocationQueryValue | LocationQueryValue[] | null | undefined,
  allowedTabs: readonly TTab[],
  fallbackTab: TTab
) {
  const normalized = normalizeTabQueryValue(value)

  if (!normalized) {
    return fallbackTab
  }

  return allowedTabs.includes(normalized as TTab) ? normalized as TTab : fallbackTab
}
