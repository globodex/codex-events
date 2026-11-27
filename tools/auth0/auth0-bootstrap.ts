import 'dotenv/config'

import { resolveAuth0AccountLinkChallengeSecret } from './generated-secrets'

type CommandMode = 'apply' | 'check'

interface TenantConfig {
  tenantDomain: string
  managementClientId: string
  managementClientSecret: string
  managementAudience: string
  appClientId: string
  appDisplayName: string
  appBaseUrl: string
  mcpResourceIdentifier: string
  mcpScope: string
  mcpClientMetadataUrls: string[]
  databaseConnectionName: string
  googleConnectionName: string
  githubConnectionName: string
  accountLinkChallengeSecret: string
  loginUri: string
  customDomain: string
  termsUrl: string
  privacyUrl: string
  actionName: string
  actionRuntime: string
  brandingPrimaryColor: string
  brandingPrimaryButtonLabelColor: string
  brandingPageBackgroundColor: string
  brandingLogoUrl: string
  brandingFaviconUrl: string
}

interface Auth0CustomDomain {
  custom_domain_id: string
  domain: string
  primary: boolean
  is_default: boolean
  status?: string
  verification?: {
    status?: string
  }
  certificate?: {
    status?: string
  }
}

interface Auth0Client {
  client_id: string
  external_client_id?: string
  external_metadata_type?: string
  external_metadata_created_by?: string
  name?: string
  app_type?: string
  is_first_party?: boolean
  callbacks?: string[]
  allowed_logout_urls?: string[]
  web_origins?: string[]
  allowed_origins?: string[]
  initiate_login_uri?: string
}

interface Auth0TenantSettings {
  default_redirection_uri?: string | null
  resource_parameter_profile?: string
  authorization_response_iss_parameter_supported?: boolean
  client_id_metadata_document_supported?: boolean
  flags?: Record<string, boolean | undefined> & {
    enable_dynamic_client_registration?: boolean
  }
}

interface Auth0ResourceServer {
  id: string
  name?: string
  identifier: string
  signing_alg?: string
  token_dialect?: string
  allow_offline_access?: boolean
  enforce_policies?: boolean
  subject_type_authorization?: {
    user?: { policy?: string }
    client?: { policy?: string }
  }
  scopes?: Array<{ value: string, description?: string }>
}

interface Auth0ClientGrant {
  id: string
  client_id?: string
  audience: string
  scope?: string[]
  subject_type?: string
  default_for?: string
}

interface Auth0Connection {
  id: string
  name: string
  strategy?: string
  is_domain_connection?: boolean
}

interface Auth0CimdRegistrationResponse {
  client_id: string
  mapped_fields?: {
    external_client_id?: string
  }
  validation?: {
    valid?: boolean
    violations?: string[]
  }
}

interface Auth0Branding {
  logo_url?: string
  favicon_url?: string
  colors?: {
    primary?: string
    page_background?: string
  }
}

interface Auth0BrandingTheme {
  themeId: string
  colors?: {
    primary_button?: string
    primary_button_label?: string
    secondary_button_border?: string
    secondary_button_label?: string
  }
}

interface Auth0UniversalLoginPageTemplate {
  body?: string
}

interface Auth0ActionVersion {
  id: string
  code?: string
  runtime?: string
  secrets?: Auth0ActionSecret[]
}

interface Auth0ActionSecret {
  name?: string
}

interface Auth0ActionSummary {
  id: string
  name: string
  runtime?: string
  code?: string
  secrets?: Auth0ActionSecret[]
  deployed_version?: Auth0ActionVersion | null
  current_version?: Auth0ActionVersion | null
  all_changes_deployed?: boolean
}

interface Auth0BindingsResponse {
  bindings: Array<{
    action?: {
      id: string
      name: string
    }
    display_name?: string
  }>
}

export class Auth0ManagementRequestError extends Error {
  path: string
  status: number
  responseBody: string

  constructor(path: string, status: number, responseBody: string) {
    super(`Auth0 management request for ${path} failed with status ${status}: ${responseBody}`)
    this.name = 'Auth0ManagementRequestError'
    this.path = path
    this.status = status
    this.responseBody = responseBody
  }
}

const consentClaimNamespace = 'https://codex-events/consents'
const accountLinkClaimNamespace = 'https://codex-events/account_linking'
const defaultActionName = 'codex-post-login'
const defaultActionRuntime = 'node22'
const defaultAuth0AppDisplayName = 'Codex Events'
const defaultAuth0DatabaseConnectionName = 'Username-Password-Authentication'
const defaultAuth0GoogleConnectionName = 'google-oauth2'
const defaultAuth0GithubConnectionName = 'github'
const defaultMcpScope = 'mcp'
const defaultBrandingPrimaryColor = '#030213'
const lightButtonLabelColor = '#ffffff'
const darkButtonLabelColor = '#030213'
const defaultBrandingPageBackgroundColor = '#f3f3f5'
const defaultBrandingWordmarkPath = '/auth0/codex-events-wordmark.svg'
const termsConsentCheckboxId = 'ulp-terms-of-service'
const privacyConsentCheckboxId = 'ulp-privacy-policy'
const loginPromptKey = 'login' as const
const signupPromptKeys = ['signup-id', 'signup'] as const
type SignupPromptKey = typeof signupPromptKeys[number]

export const requiredManagementApiScopes = [
  'read:clients',
  'create:clients',
  'update:clients',
  'read:resource_servers',
  'create:resource_servers',
  'update:resource_servers',
  'read:client_grants',
  'create:client_grants',
  'update:client_grants',
  'read:connections',
  'update:connections',
  'read:tenant_settings',
  'update:tenant_settings',
  'read:branding',
  'update:branding',
  'delete:branding',
  'read:prompts',
  'update:prompts',
  'read:custom_domains',
  'create:custom_domains',
  'update:custom_domains',
  'read:users',
  'read:actions',
  'create:actions',
  'update:actions',
  'read:triggers',
  'update:triggers',
  'update:users'
] as const

export function buildUniversalLoginPageTemplate(config: TenantConfig) {
  const linkColor = config.brandingPrimaryColor || defaultBrandingPrimaryColor
  const primaryButtonLabelColor = config.brandingPrimaryButtonLabelColor || lightButtonLabelColor

  return [
    '<!DOCTYPE html>',
    '<html>',
    '  <head>',
    '    {%- auth0:head -%}',
    '    <style>',
    `      :where(body._widget-auto-layout a) { color: ${linkColor}; }`,
    `      :where(body._widget-auto-layout a:hover) { color: ${linkColor}; opacity: 0.88; }`,
    `      :where(body._widget-auto-layout a:focus-visible) { outline: 2px solid ${linkColor}; outline-offset: 2px; }`,
    `      body._widget-auto-layout button[type="submit"]:not([value="deny"]):not([data-action="deny"]),`,
    `      body._widget-auto-layout input[type="submit"],`,
    `      body._widget-auto-layout a[role="button"] { color: ${primaryButtonLabelColor} !important; -webkit-text-fill-color: ${primaryButtonLabelColor} !important; }`,
    `      body._widget-auto-layout button[type="button"],`,
    `      body._widget-auto-layout button[value="deny"],`,
    `      body._widget-auto-layout button[data-action="deny"],`,
    `      body._widget-auto-layout button[data-action-button-secondary="true"] { color: ${darkButtonLabelColor} !important; -webkit-text-fill-color: ${darkButtonLabelColor} !important; }`,
    '      body._widget-auto-layout #prompt-logo-center {',
    '        display: block;',
    '        width: min(320px, 100%);',
    '        height: auto;',
    '        margin: 0 auto;',
    '      }',
    '    </style>',
    '  </head>',
    '  <body class="_widget-auto-layout">',
    '    {%- auth0:widget -%}',
    '  </body>',
    '</html>'
  ].join('\n')
}

export const postLoginActionCode = `const consentClaimNamespace = '${consentClaimNamespace}';
const accountLinkClaimNamespace = '${accountLinkClaimNamespace}';
const accountLinkTokenParameterName = 'session_token';

exports.onExecutePostLogin = async (event, api) => {
  const query = event.request?.query || {};
  if (event.client.client_id === event.secrets.APP_CLIENT_ID && typeof query.codex_account_proof === 'string') {
    api.idToken.setCustomClaim(accountLinkClaimNamespace + '/proof', {
      id: query.codex_account_proof, connection: event.connection.name, connectionId: event.connection.id
    });
  }
  const transactionId = query.codex_account_link;
  if (event.client.client_id === event.secrets.APP_CLIENT_ID && typeof transactionId === 'string' && transactionId) {
    if (event.user.email_verified !== true) {
      api.access.deny('account_linking_unverified');
      return;
    }
    api.transaction.setMetadata('codex_account_link', transactionId);
    const token = api.redirect.encodeToken({
      secret: requireSecret(event, 'ACCOUNT_LINK_CHALLENGE_SECRET'),
      expiresInSeconds: 60,
      payload: { purpose: 'account-link-request', aud: event.client.client_id, transaction_id: transactionId }
    });
    api.redirect.sendUserTo(requireSecret(event, 'APP_BASE_URL') + '/auth/link/login', {
      query: { session_token: token }
    });
    return;
  }
  recordConsentClaims(event, api);
};

exports.onContinuePostLogin = async (event, api) => {
  const payload = api.redirect.validateToken({
    secret: requireSecret(event, 'ACCOUNT_LINK_CHALLENGE_SECRET'),
    tokenParameterName: accountLinkTokenParameterName
  });
  if (event.client.client_id !== event.secrets.APP_CLIENT_ID || event.user.email_verified !== true
    || payload.purpose !== 'account-link-approved' || payload.aud !== 'account-link-action'
    || payload.iss !== new URL(event.secrets.APP_BASE_URL).origin || payload.sub !== event.user.user_id
    || !payload.transaction_id || payload.transaction_id !== event.transaction?.metadata?.codex_account_link) {
    api.access.deny('account_linking_mismatch');
    return;
  }
  const primary = event.user;
  const secondary = parseAuth0Subject(payload.secondary_user_id);
  const primarySubject = parseAuth0Subject(primary.user_id);
  if (!primarySubject || !secondary || !((primarySubject.provider === 'auth0' && ['google-oauth2', 'github'].includes(secondary.provider))
    || (primarySubject.provider === 'google-oauth2' && secondary.provider === 'auth0'))) {
    api.access.deny('account_linking_mismatch');
    return;
  }
  if (!identityIncludesSubject(primary.identities, payload.secondary_user_id)) {
    const token = await getManagementToken(event);
    const profile = await managementRequest(event, token, '/api/v2/users/' + encodeURIComponent(payload.secondary_user_id)
      + '?fields=user_id,email,email_verified,identities&include_fields=true', { method: 'GET' });
    if (profile.user_id !== payload.secondary_user_id || profile.email_verified !== true
      || typeof profile.email !== 'string' || profile.email.trim().toLowerCase() !== primary.email.trim().toLowerCase()
      || !Array.isArray(profile.identities) || profile.identities.length !== 1
      || !identityIncludesSubject(profile.identities, payload.secondary_user_id)
      || (secondary.provider === 'auth0' && profile.identities[0].connection !== event.secrets.DATABASE_CONNECTION_NAME)
      || !payload.secondary_connection_id || primary.identities.some(identity => identity.provider === secondary.provider)) {
      api.access.deny('account_linking_mismatch');
      return;
    }
    const linked = await managementRequest(event, token, '/api/v2/users/' + encodeURIComponent(primary.user_id) + '/identities', {
      method: 'POST', body: JSON.stringify({
        provider: secondary.provider, user_id: secondary.userId,
        ...(secondary.provider === 'auth0' ? { connection_id: payload.secondary_connection_id } : {})
      })
    });
    if (!identityIncludesSubject(linked, payload.secondary_user_id)) {
      api.access.deny('account_linking_failed');
      return;
    }
  }
  api.idToken.setCustomClaim(accountLinkClaimNamespace + '/receipt', payload.transaction_id);
  recordConsentClaims(event, api);
};

function recordConsentClaims(event, api) {
  const claimNamespace = '${consentClaimNamespace}';
  const metadata = (event.user.app_metadata && event.user.app_metadata.codex_consents) || {};
  const hasRecordedConsent = Boolean(metadata.privacy_policy_accepted_at && metadata.platform_terms_accepted_at);

  const body = (event.request && event.request.body) || {};
  const accepted = (value) => value === true
    || value === 'true'
    || value === 'on'
    || value === '1'
    || value === 1;
  const acceptedTerms = accepted(body['${termsConsentCheckboxId}']);
  const acceptedPrivacy = accepted(body['${privacyConsentCheckboxId}']);
  const acceptedThisSignup = acceptedTerms && acceptedPrivacy;

  if (!hasRecordedConsent && !acceptedThisSignup) {
    return;
  }

  if (!hasRecordedConsent) {
    const now = new Date().toISOString();
    const nextConsent = {
      ...metadata,
      privacy_policy_accepted_at: metadata.privacy_policy_accepted_at || now,
      platform_terms_accepted_at: metadata.platform_terms_accepted_at || now
    };
    api.user.setAppMetadata('codex_consents', nextConsent);
  }

  api.idToken.setCustomClaim(\`\${claimNamespace}/privacy_policy\`, true);
  api.idToken.setCustomClaim(\`\${claimNamespace}/platform_terms\`, true);
}

function parseAuth0Subject(subject) {
  const separatorIndex = typeof subject === 'string' ? subject.indexOf('|') : -1;

  if (separatorIndex <= 0 || separatorIndex === subject.length - 1) {
    return null;
  }

  return {
    provider: subject.slice(0, separatorIndex),
    userId: subject.slice(separatorIndex + 1)
  };
}

function identityIncludesSubject(identities, subject) {
  const parsedSubject = parseAuth0Subject(subject);

  return Boolean(parsedSubject)
    && Array.isArray(identities)
    && identities.some((identity) => identity.provider === parsedSubject.provider && identity.user_id === parsedSubject.userId);
}

async function managementRequest(event, token, path, init) {
  const response = await fetch(normalizeDomain(requireSecret(event, 'MANAGEMENT_API_DOMAIN')) + path, {
    ...init,
    headers: {
      authorization: 'Bearer ' + token,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error('Auth0 Management API request failed: ' + response.status);
  }

  return responseText ? JSON.parse(responseText) : null;
}

async function getManagementToken(event) {
  const managementDomain = normalizeDomain(requireSecret(event, 'MANAGEMENT_API_DOMAIN'));
  const response = await fetch(managementDomain + '/oauth/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: requireSecret(event, 'MANAGEMENT_API_CLIENT_ID'),
      client_secret: requireSecret(event, 'MANAGEMENT_API_CLIENT_SECRET'),
      audience: managementDomain + '/api/v2/'
    })
  });
  const payload = await response.json();

  if (!response.ok || !payload.access_token) {
    throw new Error('Auth0 Management API token request failed.');
  }

  return payload.access_token;
}

function normalizeDomain(domain) {
  return domain.startsWith('http://') || domain.startsWith('https://')
    ? domain.replace(/\\/+$/, '')
    : 'https://' + domain.replace(/\\/+$/, '');
}

function requireSecret(event, name) {
  const value = event.secrets && event.secrets[name];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Missing Auth0 Action secret: ' + name);
  }

  return value.trim();
}
`

function getUsageMessage() {
  return `Usage: bun tools/auth0/auth0-bootstrap.ts <apply|check>

Environment variables:
- AUTH0_MANAGEMENT_DOMAIN
- AUTH0_MGMT_CLIENT_ID
- AUTH0_MGMT_CLIENT_SECRET
- NUXT_AUTH0_CLIENT_ID
- NUXT_AUTH0_CLIENT_SECRET (required when AUTH0_ACCOUNT_LINK_CHALLENGE_SECRET is omitted)
- AUTH0_APP_DISPLAY_NAME (default: ${defaultAuth0AppDisplayName})
- AUTH0_APP_BASE_URL
- AUTH0_MCP_RESOURCE_IDENTIFIER (default: <AUTH0_APP_BASE_URL>/mcp)
- AUTH0_MCP_SCOPE (default: ${defaultMcpScope})
- AUTH0_MCP_CLIENT_METADATA_URLS (comma- or whitespace-separated trusted HTTPS CIMD URLs)
- AUTH0_LOGIN_URI (required when AUTH0_APP_BASE_URL is not https; must be https)
- AUTH0_CUSTOM_DOMAIN (default: auth.<AUTH0_APP_BASE_URL host> when AUTH0_APP_BASE_URL is https)
- AUTH0_DATABASE_CONNECTION_NAME (default: ${defaultAuth0DatabaseConnectionName})
- AUTH0_GOOGLE_CONNECTION_NAME (optional; expected Auth0 Google connection name, usually ${defaultAuth0GoogleConnectionName})
- AUTH0_GITHUB_CONNECTION_NAME (optional; expected Auth0 GitHub connection name, usually ${defaultAuth0GithubConnectionName})
- AUTH0_ACCOUNT_LINK_CHALLENGE_SECRET (optional; defaults from NUXT_AUTH0_CLIENT_SECRET)
- AUTH0_TERMS_URL (default: <AUTH0_APP_BASE_URL>/terms-and-conditions)
- AUTH0_PRIVACY_URL (default: <AUTH0_APP_BASE_URL>/privacy-policy)
- AUTH0_POST_LOGIN_ACTION_NAME (default: ${defaultActionName})
- AUTH0_POST_LOGIN_ACTION_RUNTIME (default: ${defaultActionRuntime})
- AUTH0_BRANDING_PRIMARY_COLOR (default: ${defaultBrandingPrimaryColor})
- AUTH0_BRANDING_PAGE_BACKGROUND_COLOR (default: ${defaultBrandingPageBackgroundColor})
- AUTH0_BRANDING_LOGO_URL (default: <AUTH0_APP_BASE_URL>${defaultBrandingWordmarkPath} when AUTH0_APP_BASE_URL is https)
- AUTH0_BRANDING_FAVICON_URL (default: <AUTH0_APP_BASE_URL>/favicon.ico when AUTH0_APP_BASE_URL is https)
`
}

function normalizeDomain(domain: string) {
  return domain.startsWith('http://') || domain.startsWith('https://')
    ? domain
    : `https://${domain}`
}

function splitScopeString(value: string | undefined) {
  return (value ?? '')
    .split(/\s+/)
    .map(scope => scope.trim())
    .filter(Boolean)
}

export function parseMcpClientMetadataUrls(value: string | undefined) {
  const urls = [...new Set((value ?? '').split(/[\s,]+/u).map(candidate => candidate.trim()).filter(Boolean))]

  if (urls.length === 0) {
    throw new Error('AUTH0_MCP_CLIENT_METADATA_URLS must contain at least one trusted HTTPS Client ID Metadata Document URL.')
  }

  for (const value of urls) {
    let url: URL

    try {
      url = new URL(value)
    } catch {
      throw new Error(`AUTH0_MCP_CLIENT_METADATA_URLS contains an invalid URL: ${value}`)
    }

    if (url.protocol !== 'https:' || url.username || url.password || url.hash || value.length > 120) {
      throw new Error(`AUTH0_MCP_CLIENT_METADATA_URLS contains an invalid trusted CIMD URL: ${value}`)
    }
  }

  return urls
}

function readJwtScopeClaims(accessToken: string) {
  const parts = accessToken.split('.')

  if (parts.length !== 3) {
    return {
      permissions: [] as string[],
      scope: ''
    }
  }

  try {
    const encodedPayload = parts[1] ?? ''
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
      permissions?: unknown
      scope?: unknown
    }

    return {
      permissions: Array.isArray(payload.permissions)
        ? payload.permissions.filter((permission): permission is string => typeof permission === 'string')
        : [],
      scope: typeof payload.scope === 'string' ? payload.scope : ''
    }
  } catch {
    return {
      permissions: [] as string[],
      scope: ''
    }
  }
}

export function assertManagementAccessTokenScopes(options: {
  accessToken: string
  responseScope?: string
  requiredScopes?: readonly string[]
}) {
  const jwtClaims = readJwtScopeClaims(options.accessToken)
  const grantedScopes = new Set([
    ...splitScopeString(options.responseScope),
    ...splitScopeString(jwtClaims.scope),
    ...jwtClaims.permissions
  ])
  const missingScopes = (options.requiredScopes ?? requiredManagementApiScopes)
    .filter(scope => !grantedScopes.has(scope))

  if (missingScopes.length > 0) {
    throw new Error(`Auth0 management token is missing required scopes: ${missingScopes.join(', ')}`)
  }
}

function normalizeMultiline(value: string | undefined) {
  return (value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
}

function normalizeUrlString(value: string) {
  const url = new URL(value)
  return `${url.origin}${url.pathname.replace(/\/$/, '')}${url.search}${url.hash}`
}

function normalizeHttpsUrlString(value: string, name: string) {
  const normalized = normalizeUrlString(value)

  if (!normalized.startsWith('https://')) {
    throw new Error(`${name} must be an https URL.`)
  }

  return normalized
}

function normalizeHexColor(value: string, name: string) {
  const normalized = value.trim().toLowerCase()

  if (!/^#[0-9a-f]{6}$/.test(normalized)) {
    throw new Error(`${name} must be a 6-digit hex color in the form #rrggbb.`)
  }

  return normalized
}

function normalizeOptionalHexColor(value: string | undefined, name: string) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return ''
  }
  return normalizeHexColor(trimmed, name)
}

function normalizeOptionalUrl(value: string | undefined) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return ''
  }
  return normalizeUrlString(trimmed)
}

function normalizeColorForComparison(value: string | undefined) {
  return (value ?? '').trim().toLowerCase()
}

function readHexChannel(value: string, startIndex: number) {
  return Number.parseInt(value.slice(startIndex, startIndex + 2), 16)
}

function getRelativeLuminance(hexColor: string) {
  const normalized = normalizeHexColor(hexColor, 'hex color')
  const channels = [
    readHexChannel(normalized, 1),
    readHexChannel(normalized, 3),
    readHexChannel(normalized, 5)
  ].map((channel) => {
    const normalizedChannel = channel / 255
    return normalizedChannel <= 0.03928
      ? normalizedChannel / 12.92
      : ((normalizedChannel + 0.055) / 1.055) ** 2.4
  })

  return (channels[0] * 0.2126) + (channels[1] * 0.7152) + (channels[2] * 0.0722)
}

export function resolvePrimaryButtonLabelColor(primaryColor: string) {
  return getRelativeLuminance(primaryColor) > 0.45
    ? darkButtonLabelColor
    : lightButtonLabelColor
}

export function buildDefaultBrandingTheme(config: TenantConfig) {
  const primaryColor = config.brandingPrimaryColor || defaultBrandingPrimaryColor
  const primaryButtonLabelColor = config.brandingPrimaryButtonLabelColor || resolvePrimaryButtonLabelColor(primaryColor)
  const pageBackgroundColor = config.brandingPageBackgroundColor || defaultBrandingPageBackgroundColor

  return {
    borders: {
      button_border_radius: 6,
      button_border_weight: 1,
      buttons_style: 'rounded',
      input_border_radius: 6,
      input_border_weight: 1,
      inputs_style: 'rounded',
      show_widget_shadow: true,
      widget_border_weight: 0,
      widget_corner_radius: 8
    },
    colors: {
      body_text: '#1e212a',
      error: '#d03c38',
      header: primaryColor,
      icons: '#65676e',
      input_background: '#ffffff',
      input_border: '#c9cace',
      input_filled_text: '#030213',
      input_labels_placeholders: '#65676e',
      links_focused_components: primaryColor,
      primary_button: primaryColor,
      primary_button_label: primaryButtonLabelColor,
      secondary_button_border: darkButtonLabelColor,
      secondary_button_label: darkButtonLabelColor,
      success: '#13a688',
      widget_background: '#ffffff',
      widget_border: '#c9cace',
      base_focus_color: primaryColor,
      base_hover_color: primaryColor,
      captcha_widget_theme: 'auto',
      read_only_background: '#f3f3f5'
    },
    displayName: config.appDisplayName,
    fonts: {
      body_text: { bold: false, size: 87.5 },
      buttons_text: { bold: true, size: 87.5 },
      font_url: '',
      input_labels: { bold: false, size: 87.5 },
      links: { bold: false, size: 87.5 },
      links_style: 'normal',
      reference_text_size: 16,
      subtitle: { bold: false, size: 87.5 },
      title: { bold: true, size: 112.5 }
    },
    page_background: {
      background_color: pageBackgroundColor,
      background_image_url: '',
      page_layout: 'center'
    },
    widget: {
      header_text_alignment: 'center',
      logo_height: 50,
      logo_position: config.brandingLogoUrl ? 'center' : 'none',
      logo_url: config.brandingLogoUrl,
      social_buttons_layout: 'bottom'
    }
  }
}

function normalizeUrlForComparison(value: string | undefined) {
  const trimmed = (value ?? '').trim()
  if (!trimmed) {
    return ''
  }

  try {
    return normalizeUrlString(trimmed)
  } catch {
    return trimmed
  }
}

function asSet(values: string[] | undefined) {
  return new Set((values ?? []).filter(Boolean))
}

function parseCommandMode(argument: string | undefined): CommandMode {
  if (argument === 'apply' || argument === 'check') {
    return argument
  }

  throw new Error(getUsageMessage())
}

function firstDefinedValue(...values: Array<string | undefined>) {
  for (const value of values) {
    if (value && value.trim().length > 0) {
      return value.trim()
    }
  }

  return ''
}

function normalizeHostnameString(value: string) {
  const trimmed = value.trim().replace(/\.+$/, '')

  if (/^https?:\/\//i.test(trimmed)) {
    return new URL(trimmed).hostname.toLowerCase()
  }

  return trimmed.toLowerCase()
}

function resolveAuth0CustomDomain(environment: Record<string, string | undefined>, normalizedAppBaseUrl: string) {
  const explicitDomain = firstDefinedValue(environment.AUTH0_CUSTOM_DOMAIN)

  if (explicitDomain) {
    return normalizeHostnameString(explicitDomain)
  }

  const appBaseUrl = new URL(normalizedAppBaseUrl)

  if (appBaseUrl.protocol !== 'https:') {
    throw new Error('AUTH0_CUSTOM_DOMAIN is required when AUTH0_APP_BASE_URL is not an https URL.')
  }

  return normalizeHostnameString(`auth.${appBaseUrl.hostname}`)
}

function requireConfigField(value: string, name: string) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function buildPublicAssetUrl(appBaseUrl: string, path: string) {
  return normalizeUrlString(new URL(path, `${appBaseUrl}/`).toString())
}

export function resolveConfig(environment: NodeJS.ProcessEnv): TenantConfig {
  const tenantDomain = requireConfigField(
    environment.AUTH0_MANAGEMENT_DOMAIN,
    'AUTH0_MANAGEMENT_DOMAIN'
  )
  const appBaseUrl = requireConfigField(
    environment.AUTH0_APP_BASE_URL?.trim() ?? '',
    'AUTH0_APP_BASE_URL'
  )

  const normalizedAppBaseUrl = normalizeUrlString(appBaseUrl)
  const inferredLoginUri = normalizedAppBaseUrl.startsWith('https://')
    ? `${normalizedAppBaseUrl}/auth/login`
    : ''
  const inferredBrandingLogoUrl = normalizedAppBaseUrl.startsWith('https://')
    ? buildPublicAssetUrl(normalizedAppBaseUrl, defaultBrandingWordmarkPath)
    : ''
  const inferredBrandingFaviconUrl = normalizedAppBaseUrl.startsWith('https://')
    ? buildPublicAssetUrl(normalizedAppBaseUrl, '/favicon.ico')
    : ''
  const brandingPrimaryColor = normalizeOptionalHexColor(
    firstDefinedValue(environment.AUTH0_BRANDING_PRIMARY_COLOR, defaultBrandingPrimaryColor),
    'AUTH0_BRANDING_PRIMARY_COLOR'
  )
  const defaultManagementAudience = `${normalizeDomain(tenantDomain)}/api/v2/`

  return {
    tenantDomain,
    managementClientId: requireConfigField(
      environment.AUTH0_MGMT_CLIENT_ID,
      'AUTH0_MGMT_CLIENT_ID'
    ),
    managementClientSecret: requireConfigField(
      environment.AUTH0_MGMT_CLIENT_SECRET,
      'AUTH0_MGMT_CLIENT_SECRET'
    ),
    managementAudience: defaultManagementAudience,
    appClientId: requireConfigField(
      environment.NUXT_AUTH0_CLIENT_ID?.trim() ?? '',
      'NUXT_AUTH0_CLIENT_ID'
    ),
    appDisplayName: firstDefinedValue(environment.AUTH0_APP_DISPLAY_NAME, defaultAuth0AppDisplayName),
    appBaseUrl: normalizedAppBaseUrl,
    mcpResourceIdentifier: normalizeUrlString(firstDefinedValue(
      environment.AUTH0_MCP_RESOURCE_IDENTIFIER,
      `${normalizedAppBaseUrl}/mcp`
    )),
    mcpScope: firstDefinedValue(environment.AUTH0_MCP_SCOPE, defaultMcpScope),
    mcpClientMetadataUrls: parseMcpClientMetadataUrls(environment.AUTH0_MCP_CLIENT_METADATA_URLS),
    databaseConnectionName: firstDefinedValue(environment.AUTH0_DATABASE_CONNECTION_NAME, defaultAuth0DatabaseConnectionName),
    googleConnectionName: firstDefinedValue(environment.AUTH0_GOOGLE_CONNECTION_NAME),
    githubConnectionName: firstDefinedValue(environment.AUTH0_GITHUB_CONNECTION_NAME),
    accountLinkChallengeSecret: resolveAuth0AccountLinkChallengeSecret(environment),
    loginUri: normalizeHttpsUrlString(
      requireConfigField(
        firstDefinedValue(environment.AUTH0_LOGIN_URI, inferredLoginUri),
        'AUTH0_LOGIN_URI (or inferred AUTH0_APP_BASE_URL/auth/login when AUTH0_APP_BASE_URL is https)'
      ),
      'AUTH0_LOGIN_URI (or inferred AUTH0_APP_BASE_URL/auth/login)'
    ),
    customDomain: requireConfigField(
      resolveAuth0CustomDomain(environment, normalizedAppBaseUrl),
      'AUTH0_CUSTOM_DOMAIN (or auth.<AUTH0_APP_BASE_URL host> when AUTH0_APP_BASE_URL is https)'
    ),
    termsUrl: normalizeUrlString(firstDefinedValue(environment.AUTH0_TERMS_URL, `${normalizedAppBaseUrl}/terms-and-conditions`)),
    privacyUrl: normalizeUrlString(firstDefinedValue(environment.AUTH0_PRIVACY_URL, `${normalizedAppBaseUrl}/privacy-policy`)),
    actionName: firstDefinedValue(environment.AUTH0_POST_LOGIN_ACTION_NAME, defaultActionName),
    actionRuntime: firstDefinedValue(environment.AUTH0_POST_LOGIN_ACTION_RUNTIME, defaultActionRuntime),
    brandingPrimaryColor,
    brandingPrimaryButtonLabelColor: resolvePrimaryButtonLabelColor(brandingPrimaryColor || defaultBrandingPrimaryColor),
    brandingPageBackgroundColor: normalizeOptionalHexColor(
      firstDefinedValue(environment.AUTH0_BRANDING_PAGE_BACKGROUND_COLOR, defaultBrandingPageBackgroundColor),
      'AUTH0_BRANDING_PAGE_BACKGROUND_COLOR'
    ),
    brandingLogoUrl: normalizeOptionalUrl(firstDefinedValue(environment.AUTH0_BRANDING_LOGO_URL, inferredBrandingLogoUrl)),
    brandingFaviconUrl: normalizeOptionalUrl(firstDefinedValue(environment.AUTH0_BRANDING_FAVICON_URL, inferredBrandingFaviconUrl))
  }
}

export function buildMcpResourceServerPayload(config: Pick<TenantConfig, 'appDisplayName' | 'mcpResourceIdentifier' | 'mcpScope'>) {
  return {
    name: `${config.appDisplayName} MCP`,
    identifier: config.mcpResourceIdentifier,
    signing_alg: 'RS256',
    token_dialect: 'rfc9068_profile',
    allow_offline_access: true,
    enforce_policies: false,
    subject_type_authorization: {
      user: { policy: 'require_client_grant' },
      client: { policy: 'deny_all' }
    },
    scopes: [{ value: config.mcpScope, description: 'Access Codex Events through MCP' }]
  }
}

export function buildMcpDefaultClientGrant(config: Pick<TenantConfig, 'mcpResourceIdentifier' | 'mcpScope'>) {
  return {
    audience: config.mcpResourceIdentifier,
    scope: [config.mcpScope],
    subject_type: 'user',
    default_for: 'third_party_clients'
  }
}

export function buildMcpTenantSettings() {
  return {
    resource_parameter_profile: 'compatibility',
    authorization_response_iss_parameter_supported: true,
    client_id_metadata_document_supported: true,
    flags: { enable_dynamic_client_registration: false }
  }
}

export function buildMcpTenantSettingsUpdate(_current: Auth0TenantSettings) {
  return buildMcpTenantSettings()
}

function buildExpectedConsentText() {
  return ''
}

export function buildExpectedLoginCustomText(config: TenantConfig) {
  return {
    [loginPromptKey]: {
      description: `Sign in to access your events, applications, submissions, and judging workspace in ${config.appDisplayName}.`
    }
  } as const
}

export function buildClearedSignupPartials(signupPartials: Record<string, string>) {
  const { ['form-content-end']: _ignored, ...remainingPartials } = signupPartials

  return remainingPartials
}

function hasClearedSignupPartials(partial: string | undefined) {
  return normalizeMultiline(partial) === ''
}

function hasRequiredLoginText(
  customText: Record<string, Record<string, string>> | undefined,
  config: TenantConfig
) {
  const expected = buildExpectedLoginCustomText(config)
  const description = normalizeMultiline(customText?.[loginPromptKey]?.description)

  return description === normalizeMultiline(expected[loginPromptKey].description)
}

function buildExpectedResetPasswordCustomText(config: TenantConfig) {
  return {
    'reset-password-success': {
      buttonText: 'Back to Codex Events',
      description: `Your password has been changed successfully. Continue at ${config.loginUri}.`
    },
    'reset-password-error': {
      backToLoginLinkText: 'Back to Codex Events',
      descriptionExpired: `This link has expired. Return to ${config.loginUri} and select "Forgot Your Password" to request a new email.`,
      descriptionGeneric: `There was a problem processing this request. Return to ${config.loginUri} and request a new password reset email.`,
      descriptionUsed: `This link has already been used. Return to ${config.loginUri} and request a new password reset email.`,
      eventTitleExpired: 'Link Expired',
      eventTitleGeneric: 'Link Invalid',
      eventTitleUsed: 'Link Already Used'
    }
  } as const
}

function hasRequiredResetPasswordText(
  customText: Record<string, Record<string, string>> | undefined,
  config: TenantConfig
) {
  const success = customText?.['reset-password-success'] ?? {}
  const error = customText?.['reset-password-error'] ?? {}
  const buttonText = normalizeMultiline(success.buttonText)
  const description = normalizeMultiline(success.description)
  const backToLoginLinkText = normalizeMultiline(error.backToLoginLinkText)
  const descriptionExpired = normalizeMultiline(error.descriptionExpired)
  const descriptionGeneric = normalizeMultiline(error.descriptionGeneric)
  const descriptionUsed = normalizeMultiline(error.descriptionUsed)

  return buttonText === 'Back to Codex Events'
    && description.includes(config.loginUri)
    && backToLoginLinkText === 'Back to Codex Events'
    && descriptionExpired.includes(config.loginUri)
    && descriptionGeneric.includes(config.loginUri)
    && descriptionUsed.includes(config.loginUri)
}

function resolveRetryDelay(response: Response, attempt: number) {
  const retryAfterSeconds = Number(response.headers.get('retry-after'))

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000
  }

  return Math.min(1000 * 2 ** attempt, 8000)
}

async function sleep(milliseconds: number) {
  await new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function getManagementAccessToken(config: TenantConfig) {
  const response = await fetch(`${normalizeDomain(config.tenantDomain)}/oauth/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: config.managementClientId,
      client_secret: config.managementClientSecret,
      audience: config.managementAudience
    })
  })

  if (!response.ok) {
    const reason = await response.text()
    throw new Error(`Auth0 management token request failed with status ${response.status}: ${reason}`)
  }

  const payload = await response.json() as { access_token?: string, scope?: string }

  if (!payload.access_token) {
    throw new Error('Auth0 management token response did not include an access token.')
  }

  assertManagementAccessTokenScopes({
    accessToken: payload.access_token,
    responseScope: payload.scope
  })

  return payload.access_token
}

async function auth0ManagementRequest(
  config: TenantConfig,
  token: string,
  path: string,
  init: RequestInit,
  options: { ignoreNotFound?: boolean } = {}
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${normalizeDomain(config.tenantDomain)}${path}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${token}`,
        'content-type': 'application/json',
        ...(init.headers ?? {})
      }
    })

    if (response.ok) {
      return response
    }

    if (options.ignoreNotFound && response.status === 404) {
      return response
    }

    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      await sleep(resolveRetryDelay(response, attempt))
      continue
    }

    const errorBody = await response.text()
    throw new Auth0ManagementRequestError(path, response.status, errorBody)
  }

  throw new Error(`Auth0 management request for ${path} exhausted retry attempts.`)
}

const paidAuth0LoginCustomizationPathPatterns = [
  /^\/api\/v2\/branding\/templates\/universal-login$/,
  /^\/api\/v2\/prompts\/[^/]+\/custom-text\/en$/,
  /^\/api\/v2\/prompts\/[^/]+\/partials$/
]

export function isPaidAuth0LoginCustomizationUnavailable(error: unknown) {
  return error instanceof Auth0ManagementRequestError
    && error.status === 402
    && /paid subscription is required/i.test(error.responseBody)
    && paidAuth0LoginCustomizationPathPatterns.some(pattern => pattern.test(error.path))
}

export function isAuth0DefaultBrandingThemeUnavailable(error: unknown) {
  return error instanceof Auth0ManagementRequestError
    && error.status === 404
    && error.path === '/api/v2/branding/themes/default'
    && /theme_not_found|invalid theme ID/i.test(error.responseBody)
}

function buildPaidAuth0LoginCustomizationWarning(error: Auth0ManagementRequestError) {
  return [
    'Warning: skipping Auth0 Universal Login page-template and prompt customization because',
    `${error.path} requires a paid Auth0 feature on this tenant.`,
    'The deployment will continue with supported Auth0 settings.'
  ].join(' ')
}

export async function runOptionalPaidAuth0LoginCustomization(
  run: () => Promise<void>,
  onSkip: (warning: string) => void = warning => console.warn(warning)
) {
  try {
    await run()
    return false
  } catch (error) {
    if (!isPaidAuth0LoginCustomizationUnavailable(error)) {
      throw error
    }

    onSkip(buildPaidAuth0LoginCustomizationWarning(error))
    return true
  }
}

function isCustomDomainReady(customDomain: Auth0CustomDomain) {
  return (
    customDomain.status === 'ready'
    && customDomain.verification?.status === 'verified'
    && customDomain.certificate?.status === 'provisioned'
  )
}

async function getCustomDomains(config: TenantConfig, token: string) {
  const response = await auth0ManagementRequest(config, token, '/api/v2/custom-domains', {
    method: 'GET'
  })

  return await response.json() as Auth0CustomDomain[]
}

async function ensureCustomDomain(config: TenantConfig, token: string, mode: CommandMode, failures: string[]) {
  let customDomains = await getCustomDomains(config, token)
  let customDomain = customDomains.find(domain => domain.domain === config.customDomain)

  if (!customDomain && mode === 'apply') {
    await auth0ManagementRequest(config, token, '/api/v2/custom-domains', {
      method: 'POST',
      body: JSON.stringify({
        domain: config.customDomain,
        type: 'auth0_managed_certs',
        tls_policy: 'recommended'
      })
    })
    customDomains = await getCustomDomains(config, token)
    customDomain = customDomains.find(domain => domain.domain === config.customDomain)
    console.log(`Applied: created custom domain ${config.customDomain}.`)
  }

  if (!customDomain) {
    failures.push(`Missing custom domain ${config.customDomain}.`)
    return
  }

  if (mode === 'apply' && !customDomain.primary) {
    await auth0ManagementRequest(config, token, `/api/v2/custom-domains/${encodeURIComponent(customDomain.custom_domain_id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        primary: true
      })
    })
    customDomains = await getCustomDomains(config, token)
    customDomain = customDomains.find(domain => domain.domain === config.customDomain)
    console.log(`Applied: set ${config.customDomain} as primary Auth0 custom domain.`)
  }

  if (mode === 'apply' && customDomain && isCustomDomainReady(customDomain) && !customDomain.is_default) {
    await auth0ManagementRequest(config, token, '/api/v2/custom-domains/default', {
      method: 'PATCH',
      body: JSON.stringify({
        domain: config.customDomain
      })
    })
    customDomains = await getCustomDomains(config, token)
    customDomain = customDomains.find(domain => domain.domain === config.customDomain)
    console.log(`Applied: set ${config.customDomain} as the default Auth0 custom domain.`)
  }

  if (!customDomain?.primary) {
    failures.push(`Custom domain ${config.customDomain} is not primary.`)
  }

  if (!customDomain?.is_default) {
    failures.push(`Custom domain ${config.customDomain} is not the default Auth0 custom domain for notification links.`)
  }

  if (customDomain?.status !== 'ready') {
    failures.push(`Custom domain ${config.customDomain} status is ${customDomain?.status ?? 'unknown'}, expected ready.`)
  }

  if (customDomain?.verification?.status !== 'verified') {
    failures.push(`Custom domain ${config.customDomain} verification status is ${customDomain?.verification?.status ?? 'unknown'}, expected verified.`)
  }

  if (customDomain?.certificate?.status !== 'provisioned') {
    failures.push(`Custom domain ${config.customDomain} certificate status is ${customDomain?.certificate?.status ?? 'unknown'}, expected provisioned.`)
  }
}

async function getClient(config: TenantConfig, token: string) {
  const response = await auth0ManagementRequest(config, token, `/api/v2/clients/${encodeURIComponent(config.appClientId)}`, {
    method: 'GET'
  })

  return await response.json() as Auth0Client
}

async function getTenantSettings(config: TenantConfig, token: string) {
  const response = await auth0ManagementRequest(config, token, '/api/v2/tenants/settings', {
    method: 'GET'
  })

  return await response.json() as Auth0TenantSettings
}

async function ensureMcpTenantSettings(config: TenantConfig, token: string, mode: CommandMode, failures: string[]) {
  const settings = await getTenantSettings(config, token)
  const expected = buildMcpTenantSettings()
  const hasExpectedSettings = settings.resource_parameter_profile === expected.resource_parameter_profile
    && settings.authorization_response_iss_parameter_supported === expected.authorization_response_iss_parameter_supported
    && settings.client_id_metadata_document_supported === expected.client_id_metadata_document_supported
    && settings.flags?.enable_dynamic_client_registration === false

  if (mode === 'apply' && !hasExpectedSettings) {
    const update = buildMcpTenantSettingsUpdate(settings)
    await auth0ManagementRequest(config, token, '/api/v2/tenants/settings', {
      method: 'PATCH',
      body: JSON.stringify(update)
    })
    console.log('Applied: enabled MCP resource discovery and CIMD; disabled dynamic client registration.')
  }

  const verified = mode === 'apply' && !hasExpectedSettings
    ? await getTenantSettings(config, token)
    : settings
  if (verified.resource_parameter_profile !== expected.resource_parameter_profile) {
    failures.push(`Auth0 resource_parameter_profile is ${verified.resource_parameter_profile ?? 'unset'}, expected compatibility.`)
  }
  if (verified.authorization_response_iss_parameter_supported !== true) {
    failures.push('Auth0 authorization responses do not include the issuer parameter.')
  }
  if (verified.client_id_metadata_document_supported !== true) {
    failures.push('Auth0 client ID metadata documents are not enabled.')
  }
  if (verified.flags?.enable_dynamic_client_registration !== false) {
    failures.push('Auth0 dynamic client registration is enabled; CIMD-only MCP registration requires it to be disabled.')
  }
}

function cimdClientMatches(client: Auth0Client, externalClientId: string) {
  return client.external_client_id === externalClientId
    && client.external_metadata_type === 'cimd'
    && client.external_metadata_created_by === 'admin'
}

async function getMcpCimdClient(config: TenantConfig, token: string, externalClientId: string) {
  const response = await auth0ManagementRequest(
    config,
    token,
    `/api/v2/clients?external_client_id=${encodeURIComponent(externalClientId)}&per_page=100`,
    { method: 'GET' }
  )
  const clients = await response.json() as Auth0Client[]
  return clients.find(client => client.external_client_id === externalClientId) ?? null
}

async function getAuth0ClientInventory(config: TenantConfig, token: string) {
  const response = await auth0ManagementRequest(
    config,
    token,
    '/api/v2/clients?per_page=100&include_totals=true&fields=client_id,name,app_type,is_first_party,external_client_id,external_metadata_type,external_metadata_created_by&include_fields=true',
    { method: 'GET' }
  )
  const payload = await response.json() as { clients?: Auth0Client[], total?: number } | Auth0Client[]
  return Array.isArray(payload)
    ? { total: payload.length, clients: payload }
    : { total: payload.total ?? payload.clients?.length ?? 0, clients: payload.clients ?? [] }
}

function isStaleCodexDcrClient(client: Auth0Client) {
  return client.name === 'Codex'
    && client.external_metadata_type === 'dcr'
    && client.external_metadata_created_by === 'client'
}

async function removeStaleCodexDcrClient(config: TenantConfig, token: string, client: Auth0Client) {
  const grantsResponse = await auth0ManagementRequest(
    config,
    token,
    `/api/v2/client-grants?client_id=${encodeURIComponent(client.client_id)}&per_page=100`,
    { method: 'GET' }
  )
  const grants = await grantsResponse.json() as Auth0ClientGrant[]
  for (const grant of grants) {
    await auth0ManagementRequest(config, token, `/api/v2/client-grants/${encodeURIComponent(grant.id)}`, {
      method: 'DELETE'
    })
  }
  await auth0ManagementRequest(config, token, `/api/v2/clients/${encodeURIComponent(client.client_id)}`, {
    method: 'DELETE'
  })
  console.log(`Removed stale Codex dynamic-registration client ${client.client_id}.`)
}

export async function ensureTrustedMcpCimdClients(
  config: TenantConfig,
  token: string,
  mode: CommandMode,
  failures: string[]
) {
  for (const externalClientId of config.mcpClientMetadataUrls) {
    if (mode === 'apply') {
      let response: Response
      try {
        response = await auth0ManagementRequest(config, token, '/api/v2/clients/cimd/register', {
          method: 'POST',
          body: JSON.stringify({ external_client_id: externalClientId })
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('too_many_entities')) {
          const inventory = await getAuth0ClientInventory(config, token)
          console.log(`Auth0 client inventory at CIMD capacity (${inventory.total} clients): ${JSON.stringify(inventory.clients.map(client => ({
            client_id: client.client_id,
            name: client.name,
            app_type: client.app_type,
            is_first_party: client.is_first_party,
            external_client_id: client.external_client_id,
            external_metadata_type: client.external_metadata_type,
            external_metadata_created_by: client.external_metadata_created_by
          })))}`)
          const staleClients = inventory.clients.filter(isStaleCodexDcrClient)
          for (const staleClient of staleClients) {
            await removeStaleCodexDcrClient(config, token, staleClient)
          }
          if (staleClients.length > 0) {
            response = await auth0ManagementRequest(config, token, '/api/v2/clients/cimd/register', {
              method: 'POST',
              body: JSON.stringify({ external_client_id: externalClientId })
            })
          } else {
            throw error
          }
        } else {
          throw error
        }
      }
      const registration = await response.json() as Auth0CimdRegistrationResponse

      if (!registration.client_id
        || registration.mapped_fields?.external_client_id !== externalClientId
        || registration.validation?.valid !== true) {
        failures.push(`Auth0 did not validate and register trusted MCP client metadata ${externalClientId}.`)
        continue
      }

      console.log(`Applied: registered or refreshed trusted MCP client metadata ${externalClientId}.`)
      continue
    }

    const client = await getMcpCimdClient(config, token, externalClientId)
    if (!client || !cimdClientMatches(client, externalClientId)) {
      failures.push(`Auth0 has not registered trusted MCP client metadata ${externalClientId} as an administrator-managed CIMD client.`)
    }
  }
}

async function getMcpResourceServer(config: TenantConfig, token: string) {
  const response = await auth0ManagementRequest(
    config,
    token,
    `/api/v2/resource-servers?identifier=${encodeURIComponent(config.mcpResourceIdentifier)}`,
    { method: 'GET' }
  )
  const resources = await response.json() as Auth0ResourceServer[]
  return resources.find(resource => resource.identifier === config.mcpResourceIdentifier) ?? null
}

function resourceServerMatches(resource: Auth0ResourceServer, expected: ReturnType<typeof buildMcpResourceServerPayload>) {
  return resource.name === expected.name
    && resource.identifier === expected.identifier
    && resource.signing_alg === expected.signing_alg
    && resource.token_dialect === expected.token_dialect
    && resource.allow_offline_access === expected.allow_offline_access
    && resource.enforce_policies === expected.enforce_policies
    && resource.subject_type_authorization?.user?.policy === expected.subject_type_authorization.user.policy
    && resource.subject_type_authorization?.client?.policy === expected.subject_type_authorization.client.policy
    && resource.scopes?.some(scope => scope.value === expected.scopes[0]!.value) === true
}

async function ensureMcpResourceServer(config: TenantConfig, token: string, mode: CommandMode, failures: string[]) {
  const expected = buildMcpResourceServerPayload(config)
  let resource = await getMcpResourceServer(config, token)

  if (mode === 'apply' && !resource) {
    await auth0ManagementRequest(config, token, '/api/v2/resource-servers', {
      method: 'POST',
      body: JSON.stringify(expected)
    })
    resource = await getMcpResourceServer(config, token)
    console.log(`Applied: created Auth0 MCP resource server ${config.mcpResourceIdentifier}.`)
  } else if (mode === 'apply' && resource && !resourceServerMatches(resource, expected)) {
    const { identifier: _identifier, ...resourceUpdates } = expected
    await auth0ManagementRequest(config, token, `/api/v2/resource-servers/${encodeURIComponent(resource.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(resourceUpdates)
    })
    resource = await getMcpResourceServer(config, token)
    console.log(`Applied: updated Auth0 MCP resource server ${config.mcpResourceIdentifier}.`)
  }

  if (!resource || !resourceServerMatches(resource, expected)) {
    failures.push(`Auth0 MCP resource server ${config.mcpResourceIdentifier} is missing or does not match its required RS256, RFC 9068, offline-access, user-client-grant, machine-deny, non-RBAC, and scope configuration.`)
  }
}

async function getMcpDefaultClientGrant(config: TenantConfig, token: string) {
  const response = await auth0ManagementRequest(
    config,
    token,
    `/api/v2/client-grants?audience=${encodeURIComponent(config.mcpResourceIdentifier)}&per_page=100`,
    { method: 'GET' }
  )
  const grants = await response.json() as Auth0ClientGrant[]
  return grants.find(grant => grant.default_for === 'third_party_clients') ?? null
}

function defaultClientGrantMatches(grant: Auth0ClientGrant, expected: ReturnType<typeof buildMcpDefaultClientGrant>) {
  return grant.audience === expected.audience
    && grant.subject_type === expected.subject_type
    && grant.default_for === expected.default_for
    && expected.scope.every(scope => grant.scope?.includes(scope))
}

async function ensureMcpDefaultClientGrant(config: TenantConfig, token: string, mode: CommandMode, failures: string[]) {
  const expected = buildMcpDefaultClientGrant(config)
  let grant = await getMcpDefaultClientGrant(config, token)

  if (mode === 'apply' && !grant) {
    await auth0ManagementRequest(config, token, '/api/v2/client-grants', {
      method: 'POST',
      body: JSON.stringify(expected)
    })
    grant = await getMcpDefaultClientGrant(config, token)
    console.log(`Applied: granted ${config.mcpScope} to strict third-party MCP clients.`)
  } else if (mode === 'apply' && grant && !defaultClientGrantMatches(grant, expected)) {
    await auth0ManagementRequest(config, token, `/api/v2/client-grants/${encodeURIComponent(grant.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ scope: expected.scope })
    })
    grant = await getMcpDefaultClientGrant(config, token)
    console.log(`Applied: updated the default third-party MCP client grant for ${config.mcpResourceIdentifier}.`)
  }

  if (!grant || !defaultClientGrantMatches(grant, expected)) {
    failures.push(`Auth0 has no strict default third-party user grant for ${config.mcpResourceIdentifier} with scope ${config.mcpScope}.`)
  }
}

async function getConnection(config: TenantConfig, token: string, connectionName: string) {
  const query = new URLSearchParams({
    name: connectionName,
    fields: 'id,name,strategy',
    include_fields: 'true'
  })
  const response = await auth0ManagementRequest(
    config,
    token,
    `/api/v2/connections?${query.toString()}`,
    { method: 'GET' }
  )
  const connections = await response.json() as Auth0Connection[]
  return connections.find(connection => connection.name === connectionName) ?? null
}

async function ensureDomainConnection(options: {
  config: TenantConfig
  token: string
  mode: CommandMode
  failures: string[]
  connectionName: string
  label: string
  expectedStrategy?: string
}) {
  const { config, token, mode, failures, connectionName, label, expectedStrategy } = options
  let connection = await getConnection(config, token, connectionName)

  if (connection && expectedStrategy && connection.strategy !== expectedStrategy) {
    failures.push(`Auth0 ${label} connection ${connectionName} uses strategy ${connection.strategy ?? 'unknown'}, expected ${expectedStrategy}.`)
    return
  }

  if (mode === 'apply' && connection && connection.is_domain_connection !== true) {
    await auth0ManagementRequest(config, token, `/api/v2/connections/${encodeURIComponent(connection.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_domain_connection: true })
    })
    connection = await getConnection(config, token, connectionName)
    console.log(`Applied: made Auth0 ${label} connection ${connectionName} available to third-party MCP clients.`)
  }

  if (!connection) {
    failures.push(`Auth0 ${label} connection ${connectionName} was not found.`)
  } else if (connection.is_domain_connection !== true) {
    failures.push(`Auth0 ${label} connection ${connectionName} is not a domain-level connection for third-party MCP clients.`)
  }
}

export async function ensureMcpDomainConnections(config: TenantConfig, token: string, mode: CommandMode, failures: string[]) {
  await ensureDomainConnection({
    config,
    token,
    mode,
    failures,
    connectionName: config.databaseConnectionName,
    label: 'database'
  })

  if (config.googleConnectionName) {
    await ensureDomainConnection({
      config,
      token,
      mode,
      failures,
      connectionName: config.googleConnectionName,
      label: 'Google',
      expectedStrategy: 'google-oauth2'
    })
  }

  if (config.githubConnectionName) {
    await ensureDomainConnection({
      config,
      token,
      mode,
      failures,
      connectionName: config.githubConnectionName,
      label: 'GitHub',
      expectedStrategy: 'github'
    })
  }
}

function addAll(values: Set<string>, additions: string[]) {
  let changed = false

  for (const value of additions) {
    if (!values.has(value)) {
      values.add(value)
      changed = true
    }
  }

  return changed
}

function hasAll(set: Set<string>, required: string[]) {
  return required.every(value => set.has(value))
}

export function buildRequiredClientUrls(config: Pick<TenantConfig, 'appBaseUrl'>) {
  const callbackUrls = new Set<string>()
  const logoutUrls = new Set<string>()
  const origins = new Set<string>()

  for (const baseUrl of [config.appBaseUrl]) {
    const normalizedBaseUrl = baseUrl.trim()

    if (!normalizedBaseUrl) {
      continue
    }

    const origin = new URL(normalizedBaseUrl).origin
    origins.add(origin)
    logoutUrls.add(normalizedBaseUrl)
    callbackUrls.add(new URL('/auth/callback', `${normalizedBaseUrl}/`).toString())
    callbackUrls.add(new URL('/auth/link/callback', `${normalizedBaseUrl}/`).toString())
  }

  return {
    callbacks: [...callbackUrls].sort(),
    logoutUrls: [...logoutUrls].sort(),
    origins: [...origins].sort()
  }
}

async function ensureClientUrls(config: TenantConfig, token: string, mode: CommandMode, failures: string[]) {
  const client = await getClient(config, token)
  const requiredClientUrls = buildRequiredClientUrls(config)
  const requiredCallbacks = requiredClientUrls.callbacks
  const requiredLogoutUrls = requiredClientUrls.logoutUrls
  const requiredOrigins = requiredClientUrls.origins
  const expectedLoginUri = config.loginUri
  const expectedDisplayName = config.appDisplayName

  const callbacks = asSet(client.callbacks)
  const allowedLogoutUrls = asSet(client.allowed_logout_urls)
  const webOrigins = asSet(client.web_origins)
  const allowedOrigins = asSet(client.allowed_origins)
  const currentLoginUri = client.initiate_login_uri ? normalizeUrlString(client.initiate_login_uri) : ''
  const currentDisplayName = client.name?.trim() ?? ''

  const callbackChanged = addAll(callbacks, requiredCallbacks)
  const logoutChanged = addAll(allowedLogoutUrls, requiredLogoutUrls)
  const webOriginsChanged = addAll(webOrigins, requiredOrigins)
  const allowedOriginsChanged = addAll(allowedOrigins, requiredOrigins)
  const loginUriChanged = currentLoginUri !== expectedLoginUri
  const displayNameChanged = currentDisplayName !== expectedDisplayName
  const needsPatch = callbackChanged || logoutChanged || webOriginsChanged || allowedOriginsChanged || loginUriChanged || displayNameChanged

  if (mode === 'apply' && needsPatch) {
    await auth0ManagementRequest(config, token, `/api/v2/clients/${encodeURIComponent(config.appClientId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: expectedDisplayName,
        callbacks: [...callbacks].sort(),
        allowed_logout_urls: [...allowedLogoutUrls].sort(),
        web_origins: [...webOrigins].sort(),
        allowed_origins: [...allowedOrigins].sort(),
        initiate_login_uri: expectedLoginUri
      })
    })
    console.log(`Applied: ensured display name, callback/logout/origin URLs, and initiate_login_uri on Auth0 client ${config.appClientId}.`)
  }

  const verifiedClient = mode === 'apply' && needsPatch
    ? await getClient(config, token)
    : client
  const verifiedCallbacks = asSet(verifiedClient.callbacks)
  const verifiedAllowedLogoutUrls = asSet(verifiedClient.allowed_logout_urls)
  const verifiedWebOrigins = asSet(verifiedClient.web_origins)
  const verifiedAllowedOrigins = asSet(verifiedClient.allowed_origins)
  const verifiedLoginUri = verifiedClient.initiate_login_uri ? normalizeUrlString(verifiedClient.initiate_login_uri) : ''

  if (!hasAll(verifiedCallbacks, requiredCallbacks)) {
    failures.push(`Auth0 client ${config.appClientId} is missing required callback URLs ${requiredCallbacks.join(', ')}.`)
  }

  if (!hasAll(verifiedAllowedLogoutUrls, requiredLogoutUrls)) {
    failures.push(`Auth0 client ${config.appClientId} is missing required logout URLs ${requiredLogoutUrls.join(', ')}.`)
  }

  if (!hasAll(verifiedWebOrigins, requiredOrigins)) {
    failures.push(`Auth0 client ${config.appClientId} is missing required web origins ${requiredOrigins.join(', ')}.`)
  }

  if (!hasAll(verifiedAllowedOrigins, requiredOrigins)) {
    failures.push(`Auth0 client ${config.appClientId} is missing required allowed origins ${requiredOrigins.join(', ')}.`)
  }

  if (verifiedLoginUri !== expectedLoginUri) {
    failures.push(`Auth0 client ${config.appClientId} initiate_login_uri is ${verifiedClient.initiate_login_uri ?? 'unset'}, expected ${expectedLoginUri}.`)
  }

  if ((verifiedClient.name?.trim() ?? '') !== expectedDisplayName) {
    failures.push(`Auth0 client ${config.appClientId} name is ${verifiedClient.name ?? 'unset'}, expected ${expectedDisplayName}.`)
  }
}

async function ensureTenantDefaultRedirection(config: TenantConfig, token: string, mode: CommandMode, failures: string[]) {
  const settings = await getTenantSettings(config, token)
  const expectedDefaultRedirectionUri = config.loginUri
  const currentDefaultRedirectionUri = settings.default_redirection_uri
    ? normalizeUrlString(settings.default_redirection_uri)
    : ''
  const needsPatch = currentDefaultRedirectionUri !== expectedDefaultRedirectionUri

  if (mode === 'apply' && needsPatch) {
    await auth0ManagementRequest(config, token, '/api/v2/tenants/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        default_redirection_uri: expectedDefaultRedirectionUri
      })
    })
    console.log('Applied: ensured Auth0 tenant default_redirection_uri for reset-password fallback return.')
  }

  const verifiedSettings = mode === 'apply' && needsPatch
    ? await getTenantSettings(config, token)
    : settings
  const verifiedDefaultRedirectionUri = verifiedSettings.default_redirection_uri
    ? normalizeUrlString(verifiedSettings.default_redirection_uri)
    : ''

  if (verifiedDefaultRedirectionUri !== expectedDefaultRedirectionUri) {
    failures.push(`Auth0 tenant default_redirection_uri is ${verifiedSettings.default_redirection_uri ?? 'unset'}, expected ${expectedDefaultRedirectionUri}.`)
  }
}

function hasRequestedBrandingConfig(config: TenantConfig) {
  return Boolean(
    config.brandingPrimaryColor
    || config.brandingPageBackgroundColor
    || config.brandingLogoUrl
    || config.brandingFaviconUrl
  )
}

async function getBranding(config: TenantConfig, token: string) {
  const response = await auth0ManagementRequest(config, token, '/api/v2/branding', {
    method: 'GET'
  })
  return await response.json() as Auth0Branding
}

async function ensureBranding(config: TenantConfig, token: string, mode: CommandMode, failures: string[]) {
  if (!hasRequestedBrandingConfig(config)) {
    return
  }

  const expected: Auth0Branding = {}
  if (config.brandingLogoUrl) {
    expected.logo_url = config.brandingLogoUrl
  }
  if (config.brandingFaviconUrl) {
    expected.favicon_url = config.brandingFaviconUrl
  }
  if (config.brandingPrimaryColor || config.brandingPageBackgroundColor) {
    expected.colors = {}
    if (config.brandingPrimaryColor) {
      expected.colors.primary = config.brandingPrimaryColor
    }
    if (config.brandingPageBackgroundColor) {
      expected.colors.page_background = config.brandingPageBackgroundColor
    }
  }

  const current = await getBranding(config, token)
  const currentPrimary = normalizeColorForComparison(current.colors?.primary)
  const currentPageBackground = normalizeColorForComparison(current.colors?.page_background)
  const expectedPrimary = normalizeColorForComparison(expected.colors?.primary)
  const expectedPageBackground = normalizeColorForComparison(expected.colors?.page_background)
  const currentLogoUrl = normalizeUrlForComparison(current.logo_url)
  const currentFaviconUrl = normalizeUrlForComparison(current.favicon_url)
  const expectedLogoUrl = normalizeOptionalUrl(expected.logo_url)
  const expectedFaviconUrl = normalizeOptionalUrl(expected.favicon_url)

  const primaryNeedsPatch = Boolean(expectedPrimary) && currentPrimary !== expectedPrimary
  const pageBackgroundNeedsPatch = Boolean(expectedPageBackground) && currentPageBackground !== expectedPageBackground
  const logoNeedsPatch = Boolean(expectedLogoUrl) && currentLogoUrl !== expectedLogoUrl
  const faviconNeedsPatch = Boolean(expectedFaviconUrl) && currentFaviconUrl !== expectedFaviconUrl
  const needsPatch = primaryNeedsPatch || pageBackgroundNeedsPatch || logoNeedsPatch || faviconNeedsPatch

  if (mode === 'apply' && needsPatch) {
    await auth0ManagementRequest(config, token, '/api/v2/branding', {
      method: 'PATCH',
      body: JSON.stringify(expected)
    })
    console.log('Applied: ensured Auth0 branding colors/logo/favicon.')
  }

  const verified = mode === 'apply' && needsPatch
    ? await getBranding(config, token)
    : current

  if (expectedPrimary && normalizeColorForComparison(verified.colors?.primary) !== expectedPrimary) {
    failures.push(`Auth0 branding primary color is ${verified.colors?.primary ?? 'unset'}, expected ${expected.colors?.primary}.`)
  }

  if (expectedPageBackground && normalizeColorForComparison(verified.colors?.page_background) !== expectedPageBackground) {
    failures.push(`Auth0 branding page background color is ${verified.colors?.page_background ?? 'unset'}, expected ${expected.colors?.page_background}.`)
  }

  if (expectedLogoUrl && normalizeUrlForComparison(verified.logo_url) !== expectedLogoUrl) {
    failures.push(`Auth0 branding logo_url is ${verified.logo_url ?? 'unset'}, expected ${expected.logo_url}.`)
  }

  if (expectedFaviconUrl && normalizeUrlForComparison(verified.favicon_url) !== expectedFaviconUrl) {
    failures.push(`Auth0 branding favicon_url is ${verified.favicon_url ?? 'unset'}, expected ${expected.favicon_url}.`)
  }
}

async function getDefaultBrandingTheme(config: TenantConfig, token: string) {
  try {
    const response = await auth0ManagementRequest(config, token, '/api/v2/branding/themes/default', {
      method: 'GET'
    })
    return await response.json() as Auth0BrandingTheme
  } catch (error) {
    if (isAuth0DefaultBrandingThemeUnavailable(error)) {
      return null
    }

    throw error
  }
}

async function createDefaultBrandingTheme(config: TenantConfig, token: string) {
  await auth0ManagementRequest(config, token, '/api/v2/branding/themes', {
    method: 'POST',
    body: JSON.stringify(buildDefaultBrandingTheme(config))
  })
}

async function ensureDefaultBrandingTheme(config: TenantConfig, token: string, mode: CommandMode, failures: string[]) {
  const expectedPrimaryButton = normalizeColorForComparison(config.brandingPrimaryColor)
  const expectedPrimaryButtonLabel = normalizeColorForComparison(config.brandingPrimaryButtonLabelColor)

  if (!expectedPrimaryButton || !expectedPrimaryButtonLabel) {
    return
  }

  let theme = await getDefaultBrandingTheme(config, token)

  if (!theme) {
    if (mode === 'check') {
      failures.push('Auth0 default branding theme is missing; run the Auth0 bootstrap in apply mode to create it.')
      return
    }

    await createDefaultBrandingTheme(config, token)
    console.log('Applied: created Auth0 default branding theme.')
    theme = await getDefaultBrandingTheme(config, token)

    if (!theme) {
      failures.push('Auth0 default branding theme is still missing after creation.')
      return
    }
  }

  const expectedSecondaryButtonBorder = normalizeColorForComparison(darkButtonLabelColor)
  const expectedSecondaryButtonLabel = normalizeColorForComparison(darkButtonLabelColor)
  const primaryButtonNeedsPatch = normalizeColorForComparison(theme.colors?.primary_button) !== expectedPrimaryButton
  const primaryButtonLabelNeedsPatch = normalizeColorForComparison(theme.colors?.primary_button_label) !== expectedPrimaryButtonLabel
  const secondaryButtonBorderNeedsPatch = normalizeColorForComparison(theme.colors?.secondary_button_border) !== expectedSecondaryButtonBorder
  const secondaryButtonLabelNeedsPatch = normalizeColorForComparison(theme.colors?.secondary_button_label) !== expectedSecondaryButtonLabel
  const needsPatch = primaryButtonNeedsPatch
    || primaryButtonLabelNeedsPatch
    || secondaryButtonBorderNeedsPatch
    || secondaryButtonLabelNeedsPatch

  if (mode === 'apply' && needsPatch) {
    await auth0ManagementRequest(config, token, `/api/v2/branding/themes/${encodeURIComponent(theme.themeId)}`, {
      method: 'PATCH',
      body: JSON.stringify(buildDefaultBrandingTheme(config))
    })
    console.log('Applied: ensured Auth0 default branding theme button colors.')
    theme = await getDefaultBrandingTheme(config, token)
  }

  if (normalizeColorForComparison(theme.colors?.primary_button) !== expectedPrimaryButton) {
    failures.push(`Auth0 default branding theme primary_button is ${theme.colors?.primary_button ?? 'unset'}, expected ${config.brandingPrimaryColor}.`)
  }

  if (normalizeColorForComparison(theme.colors?.primary_button_label) !== expectedPrimaryButtonLabel) {
    failures.push(`Auth0 default branding theme primary_button_label is ${theme.colors?.primary_button_label ?? 'unset'}, expected ${config.brandingPrimaryButtonLabelColor}.`)
  }

  if (normalizeColorForComparison(theme.colors?.secondary_button_border) !== expectedSecondaryButtonBorder) {
    failures.push(`Auth0 default branding theme secondary_button_border is ${theme.colors?.secondary_button_border ?? 'unset'}, expected ${darkButtonLabelColor}.`)
  }

  if (normalizeColorForComparison(theme.colors?.secondary_button_label) !== expectedSecondaryButtonLabel) {
    failures.push(`Auth0 default branding theme secondary_button_label is ${theme.colors?.secondary_button_label ?? 'unset'}, expected ${darkButtonLabelColor}.`)
  }
}

async function getSignupCustomText(config: TenantConfig, token: string, promptKey: SignupPromptKey) {
  const response = await auth0ManagementRequest(config, token, `/api/v2/prompts/${promptKey}/custom-text/en`, {
    method: 'GET'
  })
  return await response.json() as Record<string, { ['var-tos']?: string }>
}

async function getLoginCustomText(config: TenantConfig, token: string) {
  const response = await auth0ManagementRequest(config, token, `/api/v2/prompts/${loginPromptKey}/custom-text/en`, {
    method: 'GET'
  })
  return await response.json() as Record<string, Record<string, string>>
}

async function getUniversalLoginPageTemplate(config: TenantConfig, token: string) {
  const response = await auth0ManagementRequest(
    config,
    token,
    '/api/v2/branding/templates/universal-login',
    {
      method: 'GET'
    },
    { ignoreNotFound: true }
  )

  if (response.status === 404) {
    return null
  }

  return await response.json() as Auth0UniversalLoginPageTemplate
}

async function ensureUniversalLoginPageTemplate(config: TenantConfig, token: string, mode: CommandMode, failures: string[]) {
  const expectedBody = buildUniversalLoginPageTemplate(config)
  let pageTemplate = await getUniversalLoginPageTemplate(config, token)
  let currentBody = pageTemplate?.body ?? ''

  if (mode === 'apply' && normalizeMultiline(currentBody) !== normalizeMultiline(expectedBody)) {
    await auth0ManagementRequest(config, token, '/api/v2/branding/templates/universal-login', {
      method: 'PUT',
      headers: {
        'content-type': 'text/html'
      },
      body: expectedBody
    })
    console.log('Applied: synced canonical Universal Login page template.')
    pageTemplate = await getUniversalLoginPageTemplate(config, token)
    currentBody = pageTemplate?.body ?? ''
  }

  if (normalizeMultiline(currentBody) !== normalizeMultiline(expectedBody)) {
    failures.push('Auth0 Universal Login page template does not match the canonical Codex Events template.')
  }
}

async function ensureLoginCustomText(config: TenantConfig, token: string, mode: CommandMode, failures: string[]) {
  const expected = buildExpectedLoginCustomText(config)
  let current = await getLoginCustomText(config, token)

  if (
    mode === 'apply'
    && normalizeMultiline(JSON.stringify(current)) !== normalizeMultiline(JSON.stringify(expected))
  ) {
    await auth0ManagementRequest(config, token, `/api/v2/prompts/${loginPromptKey}/custom-text/en`, {
      method: 'PUT',
      body: JSON.stringify({
        [loginPromptKey]: {
          ...current[loginPromptKey],
          ...expected[loginPromptKey]
        }
      })
    })
    current = await getLoginCustomText(config, token)
    console.log('Applied: updated login prompt description copy.')
  }

  if (!hasRequiredLoginText(current, config)) {
    failures.push('Auth0 login prompt copy is missing the canonical Codex Events subtitle.')
  }
}

async function ensureSignupCustomText(config: TenantConfig, token: string, mode: CommandMode, failures: string[]) {
  const expectedConsentText = buildExpectedConsentText()
  for (const promptKey of signupPromptKeys) {
    let currentCustomText = await getSignupCustomText(config, token, promptKey)
    let currentValue = currentCustomText[promptKey]?.['var-tos'] ?? ''

    if (mode === 'apply' && normalizeMultiline(currentValue) !== normalizeMultiline(expectedConsentText)) {
      await auth0ManagementRequest(config, token, `/api/v2/prompts/${promptKey}/custom-text/en`, {
        method: 'PUT',
        body: JSON.stringify({
          [promptKey]: {
            ...currentCustomText[promptKey],
            'var-tos': expectedConsentText
          }
        })
      })
      currentCustomText = await getSignupCustomText(config, token, promptKey)
      currentValue = currentCustomText[promptKey]?.['var-tos'] ?? ''
      console.log(`Applied: cleared signup prompt (${promptKey}) custom consent text (var-tos).`)
    }

    if (normalizeMultiline(currentValue) !== normalizeMultiline(expectedConsentText)) {
      failures.push(`Auth0 signup prompt (${promptKey}) custom text var-tos should be empty because platform consent is app-owned.`)
    }
  }
}

async function getSignupPartials(config: TenantConfig, token: string, promptKey: SignupPromptKey) {
  const response = await auth0ManagementRequest(config, token, `/api/v2/prompts/${promptKey}/partials`, {
    method: 'GET'
  }, { ignoreNotFound: true })

  if (response.status === 404) {
    return {}
  }

  return await response.json() as Record<string, Record<string, string>>
}

async function ensureSignupPartials(config: TenantConfig, token: string, mode: CommandMode, failures: string[]) {
  for (const promptKey of signupPromptKeys) {
    let currentPartials = await getSignupPartials(config, token, promptKey)
    let signupPartials = currentPartials[promptKey] ?? {}
    let currentFormContentEnd = signupPartials['form-content-end']

    if (mode === 'apply' && !hasClearedSignupPartials(currentFormContentEnd)) {
      await auth0ManagementRequest(config, token, `/api/v2/prompts/${promptKey}/partials`, {
        method: 'PUT',
        body: JSON.stringify({
          [promptKey]: buildClearedSignupPartials(signupPartials)
        })
      })
      currentPartials = await getSignupPartials(config, token, promptKey)
      signupPartials = currentPartials[promptKey] ?? {}
      currentFormContentEnd = signupPartials['form-content-end']
      console.log(`Applied: cleared signup prompt partial form-content-end for ${promptKey}.`)
    }

    if (!hasClearedSignupPartials(currentFormContentEnd)) {
      failures.push(`Auth0 signup prompt (${promptKey}) partial form-content-end should be empty because platform consent is app-owned.`)
    }
  }
}

async function getResetPasswordCustomText(config: TenantConfig, token: string) {
  const response = await auth0ManagementRequest(config, token, '/api/v2/prompts/reset-password/custom-text/en', {
    method: 'GET'
  })
  return await response.json() as Record<string, Record<string, string>>
}

async function ensureResetPasswordCustomText(config: TenantConfig, token: string, mode: CommandMode, failures: string[]) {
  const expected = buildExpectedResetPasswordCustomText(config)
  let current = await getResetPasswordCustomText(config, token)

  if (
    mode === 'apply'
    && normalizeMultiline(JSON.stringify(current)) !== normalizeMultiline(JSON.stringify(expected))
  ) {
    await auth0ManagementRequest(config, token, '/api/v2/prompts/reset-password/custom-text/en', {
      method: 'PUT',
      body: JSON.stringify(expected)
    })
    current = await getResetPasswordCustomText(config, token)
    console.log('Applied: updated reset-password success/error copy with app return CTA.')
  }

  if (!hasRequiredResetPasswordText(current, config)) {
    failures.push('Auth0 reset-password copy is missing required app return CTA text for success and error states.')
  }
}

async function listActions(config: TenantConfig, token: string) {
  const response = await auth0ManagementRequest(config, token, '/api/v2/actions/actions?per_page=100', {
    method: 'GET'
  })
  const payload = await response.json() as { actions?: Auth0ActionSummary[] } | Auth0ActionSummary[]

  if (Array.isArray(payload)) {
    return payload
  }

  return payload.actions ?? []
}

export function buildPostLoginActionSecrets(config: TenantConfig) {
  return [
    {
      name: 'APP_BASE_URL',
      value: config.appBaseUrl
    },
    {
      name: 'APP_CLIENT_ID',
      value: config.appClientId
    },
    {
      name: 'DATABASE_CONNECTION_NAME',
      value: config.databaseConnectionName
    },
    {
      name: 'ACCOUNT_LINK_CHALLENGE_SECRET',
      value: config.accountLinkChallengeSecret
    },
    {
      name: 'MANAGEMENT_API_DOMAIN',
      value: config.tenantDomain
    },
    {
      name: 'MANAGEMENT_API_CLIENT_ID',
      value: config.managementClientId
    },
    {
      name: 'MANAGEMENT_API_CLIENT_SECRET',
      value: config.managementClientSecret
    }
  ]
}

function hasRequiredActionSecretNames(action: Auth0ActionSummary, config: TenantConfig) {
  const secretNames = new Set([
    ...(action.secrets ?? []),
    ...(action.current_version?.secrets ?? []),
    ...(action.deployed_version?.secrets ?? [])
  ].map(secret => secret.name).filter(Boolean))

  return buildPostLoginActionSecrets(config).every(secret => secretNames.has(secret.name))
}

async function ensureAction(config: TenantConfig, token: string, mode: CommandMode, failures: string[]) {
  let actions = await listActions(config, token)
  let action = actions.find(candidate => candidate.name === config.actionName)
  const expectedSecrets = buildPostLoginActionSecrets(config)

  if (!action && mode === 'apply') {
    const response = await auth0ManagementRequest(config, token, '/api/v2/actions/actions', {
      method: 'POST',
      body: JSON.stringify({
        name: config.actionName,
        supported_triggers: [{ id: 'post-login', version: 'v3' }],
        runtime: config.actionRuntime,
        code: postLoginActionCode,
        secrets: expectedSecrets
      })
    })
    action = await response.json() as Auth0ActionSummary
    console.log(`Applied: created Auth0 post-login action ${config.actionName}.`)
  }

  if (!action) {
    failures.push(`Missing Auth0 action ${config.actionName}.`)
    return null
  }

  const expectedCode = normalizeMultiline(postLoginActionCode)

  if (mode === 'apply') {
    await auth0ManagementRequest(config, token, `/api/v2/actions/actions/${encodeURIComponent(action.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        runtime: config.actionRuntime,
        code: postLoginActionCode,
        secrets: expectedSecrets
      })
    })
    console.log(`Applied: synced Auth0 action ${config.actionName} code/runtime/secrets.`)
    actions = await listActions(config, token)
    action = actions.find(candidate => candidate.name === config.actionName)
  }

  if (!action) {
    failures.push(`Auth0 action ${config.actionName} could not be loaded after update.`)
    return null
  }

  const stillNeedsDeploy = normalizeMultiline(action.deployed_version?.code) !== expectedCode
    || !action.all_changes_deployed

  if (mode === 'apply' && stillNeedsDeploy) {
    await auth0ManagementRequest(config, token, `/api/v2/actions/actions/${encodeURIComponent(action.id)}/deploy`, {
      method: 'POST',
      body: JSON.stringify({})
    })
    console.log(`Applied: deployed Auth0 action ${config.actionName}.`)
  }

  const refreshedActions = await listActions(config, token)
  const refreshedAction = refreshedActions.find(candidate => candidate.name === config.actionName)

  if (!refreshedAction) {
    failures.push(`Auth0 action ${config.actionName} could not be loaded after deploy.`)
    return null
  }

  const refreshedDeployedCode = normalizeMultiline(refreshedAction.deployed_version?.code)

  if (refreshedDeployedCode !== expectedCode) {
    failures.push(`Auth0 action ${config.actionName} deployed code does not match expected canonical post-login logic.`)
  }

  if (normalizeMultiline(refreshedAction.runtime) !== normalizeMultiline(config.actionRuntime)) {
    failures.push(`Auth0 action ${config.actionName} runtime is ${refreshedAction.runtime ?? 'unknown'}, expected ${config.actionRuntime}.`)
  }

  if (!hasRequiredActionSecretNames(refreshedAction, config)) {
    failures.push(`Auth0 action ${config.actionName} is missing one or more required Action secrets.`)
  }

  return refreshedAction
}

async function getPostLoginBindings(config: TenantConfig, token: string) {
  const response = await auth0ManagementRequest(config, token, '/api/v2/actions/triggers/post-login/bindings', {
    method: 'GET'
  })
  return await response.json() as Auth0BindingsResponse
}

async function ensureActionBinding(
  config: TenantConfig,
  token: string,
  mode: CommandMode,
  action: Auth0ActionSummary | null,
  failures: string[]
) {
  if (!action) {
    failures.push(`Cannot verify post-login action bindings because action ${config.actionName} is missing.`)
    return
  }

  const bindings = await getPostLoginBindings(config, token)
  const hasActionBinding = bindings.bindings.some(binding =>
    binding.action?.id === action.id || binding.action?.name === config.actionName
  )

  if (mode === 'apply' && !hasActionBinding) {
    const nextBindings = bindings.bindings.map(binding => ({
      ref: {
        type: 'action_name',
        value: binding.action?.name ?? ''
      },
      display_name: binding.display_name ?? binding.action?.name ?? ''
    }))
      .filter(binding => binding.ref.value.length > 0)

    nextBindings.push({
      ref: {
        type: 'action_name',
        value: config.actionName
      },
      display_name: config.actionName
    })

    await auth0ManagementRequest(config, token, '/api/v2/actions/triggers/post-login/bindings', {
      method: 'PATCH',
      body: JSON.stringify({
        bindings: nextBindings
      })
    })
    console.log(`Applied: bound Auth0 action ${config.actionName} to post-login trigger.`)
  }

  const refreshedBindings = await getPostLoginBindings(config, token)
  const nowHasBinding = refreshedBindings.bindings.some(binding =>
    binding.action?.id === action.id || binding.action?.name === config.actionName
  )

  if (!nowHasBinding) {
    failures.push(`Auth0 action ${config.actionName} is not bound to the post-login trigger.`)
  }
}

export async function main() {
  try {
    const mode = parseCommandMode(process.argv[2])
    const config = resolveConfig(process.env)
    const managementToken = await getManagementAccessToken(config)
    const failures: string[] = []

    console.log(`Auth0 bootstrap mode: ${mode}`)
    console.log(`Tenant domain: ${config.tenantDomain}`)
    console.log(`Custom domain target: ${config.customDomain}`)
    console.log(`App base URL target: ${config.appBaseUrl}`)
    console.log(`MCP resource target: ${config.mcpResourceIdentifier}`)

    await ensureCustomDomain(config, managementToken, mode, failures)
    await ensureClientUrls(config, managementToken, mode, failures)
    await ensureTenantDefaultRedirection(config, managementToken, mode, failures)
    await ensureMcpResourceServer(config, managementToken, mode, failures)
    await ensureMcpDefaultClientGrant(config, managementToken, mode, failures)
    await ensureMcpTenantSettings(config, managementToken, mode, failures)
    await ensureTrustedMcpCimdClients(config, managementToken, mode, failures)
    await ensureMcpDomainConnections(config, managementToken, mode, failures)
    await ensureBranding(config, managementToken, mode, failures)
    await ensureDefaultBrandingTheme(config, managementToken, mode, failures)
    await runOptionalPaidAuth0LoginCustomization(async () => {
      await ensureUniversalLoginPageTemplate(config, managementToken, mode, failures)
      await ensureLoginCustomText(config, managementToken, mode, failures)
      await ensureSignupCustomText(config, managementToken, mode, failures)
      await ensureSignupPartials(config, managementToken, mode, failures)
      await ensureResetPasswordCustomText(config, managementToken, mode, failures)
    })
    const action = await ensureAction(config, managementToken, mode, failures)
    await ensureActionBinding(config, managementToken, mode, action, failures)

    if (failures.length > 0) {
      console.error('Auth0 bootstrap check failed:')
      for (const failure of failures) {
        console.error(`- ${failure}`)
      }
      process.exit(1)
    }

    console.log('Auth0 bootstrap check passed.')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exit(1)
  }
}

if (import.meta.main) {
  main()
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      console.error(message)
      process.exit(1)
    })
}
