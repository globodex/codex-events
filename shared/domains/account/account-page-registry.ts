export const accountPageNames = [
  'admin-workspace',
  'overview',
  'judging',
  'staff-workspace',
  'prize-redemptions-workspace'
] as const

export type AccountPageName = (typeof accountPageNames)[number]
export type AccountPageRoutePath<TPage extends AccountPageName = AccountPageName>
  = TPage extends 'prize-redemptions-workspace'
    ? '/api/prize-redemptions/workspace'
    : `/api/account/${TPage}`

export const accountPagePaths = {
  'admin-workspace': '/api/account/admin-workspace',
  'overview': '/api/account/overview',
  'judging': '/api/account/judging',
  'staff-workspace': '/api/account/staff-workspace',
  'prize-redemptions-workspace': '/api/prize-redemptions/workspace'
} as const satisfies { [TPage in AccountPageName]: AccountPageRoutePath<TPage> }
