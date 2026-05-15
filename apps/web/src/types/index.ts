// Auth types
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

// User types
export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: Role
  orgId: string
  isActive: boolean
  twoFactorEnabled: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  logoUrl?: string
  primaryColor?: string
  domain?: string
  timezone: string
  currencies: string[]
  createdAt: string
}

// API types
export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, string[]>
}

export type SortOrder = 'asc' | 'desc'

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: SortOrder
  search?: string
}

// Channel types
export type SalesChannel =
  | 'AMAZON_US'
  | 'AMAZON_IN'
  | 'AMAZON_UK'
  | 'AMAZON_AE'
  | 'AMAZON_AU'
  | 'WALMART'
  | 'TIKTOK_SHOP'
  | 'SHOPIFY'
  | 'MYNTRA'
  | 'FLIPKART'
  | 'MANUAL'
  | 'OTHER'

export type ChannelStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING'

export interface ChannelConfig {
  id: string
  orgId: string
  channel: SalesChannel
  status: ChannelStatus
  displayName: string
  credentials: Record<string, string>
  lastSyncAt?: string
  syncEnabled: boolean
  createdAt: string
}

export const CHANNEL_LABELS: Record<SalesChannel, string> = {
  AMAZON_US: 'Amazon US',
  AMAZON_IN: 'Amazon India',
  AMAZON_UK: 'Amazon UK',
  AMAZON_AE: 'Amazon UAE',
  AMAZON_AU: 'Amazon Australia',
  WALMART: 'Walmart',
  TIKTOK_SHOP: 'TikTok Shop',
  SHOPIFY: 'Shopify',
  MYNTRA: 'Myntra',
  FLIPKART: 'Flipkart',
  MANUAL: 'Manual Entry',
  OTHER: 'Other',
}

// Currency types
export type CurrencyCode = 'USD' | 'INR' | 'AED' | 'GBP' | 'AUD' | 'EUR' | 'CAD' | 'SGD'

export const CURRENCY_CONFIG: Record<CurrencyCode, { symbol: string; name: string; locale: string }> = {
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  INR: { symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  AED: { symbol: 'AED', name: 'UAE Dirham', locale: 'ar-AE' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  EUR: { symbol: '€', name: 'Euro', locale: 'de-DE' },
  CAD: { symbol: 'CA$', name: 'Canadian Dollar', locale: 'en-CA' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
}

export function formatCurrency(amount: number, currency: CurrencyCode = 'USD'): string {
  const config = CURRENCY_CONFIG[currency]
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
