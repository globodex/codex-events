import { listAllPaginatedItems } from '~/lib/api'

export interface McpAccessToken {
  id: string
  name: string
  displayPrefix: string
  expiresAt: string
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export interface McpTokenRequester {
  <T>(path: string, options?: Record<string, unknown>): Promise<T>
}

export interface McpAccessTokenPage {
  data: McpAccessToken[]
  meta: { page: number, pageSize: number, total: number }
}

export async function listAccountMcpTokens(request: McpTokenRequester, page = 1, pageSize = 100, signal?: AbortSignal) {
  return await request<McpAccessTokenPage>('/api/account/mcp-tokens', {
    query: { page, pageSize },
    signal
  })
}

export async function listAllActiveAccountMcpTokens(request: McpTokenRequester, signal?: AbortSignal) {
  const tokens = await listAllPaginatedItems(
    (page, pageSize, pageSignal) => listAccountMcpTokens(request, page, pageSize, pageSignal),
    100,
    signal
  )
  return tokens.filter(token => token.revokedAt === null)
}

export async function createAccountMcpToken(request: McpTokenRequester, name: string) {
  const response = await request<{ data: { token: McpAccessToken, credential: string } }>('/api/account/mcp-tokens', {
    method: 'POST',
    body: { name }
  })
  return response.data
}

export async function revokeAccountMcpToken(request: McpTokenRequester, tokenId: string) {
  await request(`/api/account/mcp-tokens/${tokenId}`, { method: 'DELETE' })
}

export async function copyMcpCredential(clipboard: Pick<Clipboard, 'writeText'>, credential: string) {
  await clipboard.writeText(credential)
}
