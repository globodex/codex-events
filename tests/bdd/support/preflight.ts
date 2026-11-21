import { createAuthenticatedApiClient } from './api-client.ts'
import { getStablePersonas } from './personas.ts'

export default async function preflight() {
  for (const persona of getStablePersonas()) {
    const api = await createAuthenticatedApiClient(persona.key)
    try {
      const response = await api.get('/api/session', { maxRedirects: 0 })
      if (!response.ok()) {
        throw new Error(`BDD session for ${persona.key} returned HTTP ${response.status()}.`)
      }

      const { data } = await response.json()
      if (data?.actor?.platformUser?.email !== persona.email) {
        throw new Error(`BDD session for ${persona.key} did not resolve to its local account.`)
      }
    } finally {
      await api.dispose()
    }
  }
}
