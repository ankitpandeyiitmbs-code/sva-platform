export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'FINANCE'
  | 'MARKETING'
  | 'SUPPORT'
  | 'WAREHOUSE'
  | 'SALES'
  | 'VIEWER'
  | 'GUEST'

export type Permission =
  | 'dashboard:read'
  | 'dashboard:write'
  | 'crm:read'
  | 'crm:write'
  | 'crm:delete'
  | 'orders:read'
  | 'orders:write'
  | 'inventory:read'
  | 'inventory:write'
  | 'finance:read'
  | 'finance:write'
  | 'marketing:read'
  | 'marketing:write'
  | 'support:read'
  | 'support:write'
  | 'chat:read'
  | 'chat:write'
  | 'projects:read'
  | 'projects:write'
  | 'automation:read'
  | 'automation:write'
  | 'settings:read'
  | 'settings:write'
  | 'users:read'
  | 'users:write'
  | 'audit:read'
  | 'api:access'

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    'dashboard:read', 'dashboard:write', 'crm:read', 'crm:write', 'crm:delete',
    'orders:read', 'orders:write', 'inventory:read', 'inventory:write',
    'finance:read', 'finance:write', 'marketing:read', 'marketing:write',
    'support:read', 'support:write', 'chat:read', 'chat:write',
    'projects:read', 'projects:write', 'automation:read', 'automation:write',
    'settings:read', 'settings:write', 'users:read', 'users:write', 'audit:read', 'api:access',
  ],
  ADMIN: [
    'dashboard:read', 'dashboard:write', 'crm:read', 'crm:write',
    'orders:read', 'orders:write', 'inventory:read', 'inventory:write',
    'finance:read', 'marketing:read', 'marketing:write',
    'support:read', 'support:write', 'chat:read', 'chat:write',
    'projects:read', 'projects:write', 'automation:read', 'automation:write',
    'settings:read', 'users:read', 'users:write', 'audit:read',
  ],
  MANAGER: [
    'dashboard:read', 'crm:read', 'crm:write', 'orders:read', 'orders:write',
    'inventory:read', 'inventory:write', 'marketing:read', 'marketing:write',
    'support:read', 'support:write', 'chat:read', 'chat:write',
    'projects:read', 'projects:write',
  ],
  FINANCE: [
    'dashboard:read', 'finance:read', 'finance:write', 'orders:read',
    'inventory:read', 'chat:read', 'chat:write', 'projects:read',
  ],
  MARKETING: [
    'dashboard:read', 'crm:read', 'marketing:read', 'marketing:write',
    'chat:read', 'chat:write', 'projects:read', 'projects:write',
  ],
  SUPPORT: [
    'dashboard:read', 'crm:read', 'orders:read', 'support:read', 'support:write',
    'chat:read', 'chat:write',
  ],
  WAREHOUSE: [
    'dashboard:read', 'orders:read', 'orders:write', 'inventory:read', 'inventory:write',
    'chat:read', 'chat:write',
  ],
  SALES: [
    'dashboard:read', 'crm:read', 'crm:write', 'orders:read',
    'chat:read', 'chat:write', 'projects:read',
  ],
  VIEWER: ['dashboard:read', 'chat:read'],
  GUEST: ['dashboard:read'],
}

export interface JWTPayload {
  sub: string
  email: string
  role: Role
  orgId: string
  permissions: Permission[]
  iat: number
  exp: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}
