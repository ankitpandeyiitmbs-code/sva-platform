import type { Role } from './auth'

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
