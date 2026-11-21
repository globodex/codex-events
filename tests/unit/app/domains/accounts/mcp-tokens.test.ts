import { describe, expect, test, vi } from 'vitest'

import {
  copyMcpCredential,
  createAccountMcpToken,
  listAllActiveAccountMcpTokens,
  listAccountMcpTokens,
  revokeAccountMcpToken
} from '../../../../../app/domains/accounts/mcp-tokens'

describe('account MCP token panel actions', () => {
  test('lists, creates, copies once-visible credentials, and revokes through focused APIs', async () => {
    const token = {
      id: 'token_1', name: 'Codex', displayPrefix: 'ce_mcp_token',
      expiresAt: '2026-09-12T00:00:00.000Z', lastUsedAt: null, revokedAt: null,
      createdAt: '2026-08-13T00:00:00.000Z'
    }
    const request = vi.fn(async (path: string, options?: Record<string, unknown>) => {
      if (path === '/api/account/mcp-tokens' && options?.method === 'POST') {
        return { data: { token, credential: 'ce_mcp_secret' } }
      }
      if (path === '/api/account/mcp-tokens') return { data: [token], meta: { page: 1, pageSize: 100, total: 1 } }
      return { data: token }
    })
    const clipboard = { writeText: vi.fn(async () => undefined) }

    expect(await listAccountMcpTokens(request)).toEqual({ data: [token], meta: { page: 1, pageSize: 100, total: 1 } })
    expect(request).toHaveBeenCalledWith('/api/account/mcp-tokens', { query: { page: 1, pageSize: 100 }, signal: undefined })
    expect(await createAccountMcpToken(request, 'Codex')).toEqual({ token, credential: 'ce_mcp_secret' })
    await copyMcpCredential(clipboard, 'ce_mcp_secret')
    expect(clipboard.writeText).toHaveBeenCalledWith('ce_mcp_secret')
    await revokeAccountMcpToken(request, token.id)
    expect(request).toHaveBeenCalledWith('/api/account/mcp-tokens/token_1', { method: 'DELETE' })
  })

  test('loads every historical page while omitting revoked tokens from the account UI', async () => {
    const tokens = Array.from({ length: 101 }, (_, index) => ({
      id: `token_${index}`, name: `Token ${index}`, displayPrefix: `ce_mcp_${index}`,
      expiresAt: '2026-09-12T00:00:00.000Z', lastUsedAt: null,
      revokedAt: index === 100 ? null : '2026-08-13T00:00:00.000Z',
      createdAt: '2026-08-13T00:00:00.000Z'
    }))
    const request = vi.fn(async (_path: string, options?: Record<string, unknown>) => {
      const page = (options?.query as { page: number }).page
      return {
        data: page === 1 ? tokens.slice(0, 100) : tokens.slice(100),
        meta: { page, pageSize: 100, total: tokens.length }
      }
    })

    const listed = await listAllActiveAccountMcpTokens(request)
    expect(listed).toEqual([expect.objectContaining({ id: 'token_100', revokedAt: null })])
    expect(request).toHaveBeenCalledTimes(2)
  })
})
