import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import speakeasy from 'speakeasy'
import qrcode from 'qrcode'
import { prisma } from '../lib/db'
import { env } from '../utils/env'
import { ROLE_PERMISSIONS } from '../lib/types'
import type { JWTPayload, AuthTokens, Role } from '../lib/types'

export class AuthService {
  // ── Token Generation ──────────────────────────────────
  private generateTokens(user: { id: string; email: string; role: string; orgId: string }): AuthTokens {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      orgId: user.orgId,
      permissions: ROLE_PERMISSIONS[user.role as Role] ?? [],
    }

    const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY as any })
    const refreshToken = jwt.sign({ sub: user.id }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRY as any })

    return { accessToken, refreshToken, expiresIn: 15 * 60 }
  }

  // ── Login ─────────────────────────────────────────────
  async login(email: string, password: string, orgSlug: string, ip?: string) {
    const org = await prisma.organization.findUnique({ where: { slug: orgSlug } })
    if (!org) throw new Error('Organization not found')

    const user = await prisma.user.findUnique({ where: { email_orgId: { email, orgId: org.id } } })
    if (!user || !user.passwordHash) throw new Error('Invalid credentials')
    if (!user.isActive) throw new Error('Account is disabled')

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new Error('Invalid credentials')

    if (user.twoFactorEnabled) {
      return { requiresTwoFactor: true, userId: user.id }
    }

    const tokens = this.generateTokens(user)
    await this.saveRefreshToken(user.id, tokens.refreshToken)
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), lastLoginIp: ip } })
    await this.audit(org.id, user.id, 'auth.login', 'user', user.id, ip)

    return { tokens, user: this.sanitizeUser(user) }
  }

  // ── 2FA Verify ────────────────────────────────────────
  async verifyTwoFactor(userId: string, code: string, ip?: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (!user.twoFactorSecret) throw new Error('2FA not configured')

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    })
    if (!valid) throw new Error('Invalid 2FA code')

    const tokens = this.generateTokens(user)
    await this.saveRefreshToken(userId, tokens.refreshToken)
    await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date(), lastLoginIp: ip } })

    return { tokens, user: this.sanitizeUser(user) }
  }

  // ── Register (first user = SUPER_ADMIN, others = invited) ──
  async register(data: {
    email: string
    password: string
    name: string
    orgName: string
    orgSlug: string
    timezone?: string
    currencies?: string[]
  }) {
    const existing = await prisma.organization.findUnique({ where: { slug: data.orgSlug } })
    if (existing) throw new Error('Organization slug already taken')

    const passwordHash = await bcrypt.hash(data.password, 12)

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: data.orgName,
          slug: data.orgSlug,
          timezone: data.timezone ?? 'UTC',
          currencies: data.currencies ?? ['USD'],
        },
      })

      const user = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash,
          role: 'SUPER_ADMIN',
          emailVerified: true,
          orgId: org.id,
        },
      })

      // Seed default dashboard + chat channels
      await tx.dashboard.create({
        data: { orgId: org.id, name: 'Overview', isDefault: true, createdBy: user.id },
      })
      await tx.chatChannel.create({
        data: { orgId: org.id, name: 'general', slug: 'general', type: 'CHANNEL' },
      })
      await tx.chatChannel.create({
        data: { orgId: org.id, name: 'alerts', slug: 'alerts', type: 'CHANNEL' },
      })

      return { org, user }
    })

    const tokens = this.generateTokens(result.user)
    await this.saveRefreshToken(result.user.id, tokens.refreshToken)

    return { tokens, user: this.sanitizeUser(result.user), org: result.org }
  }

  // ── Refresh Token ─────────────────────────────────────
  async refreshTokens(refreshToken: string) {
    let decoded: { sub: string }
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sub: string }
    } catch {
      throw new Error('Invalid refresh token')
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } })
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new Error('Refresh token expired or revoked')
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: decoded.sub } })
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } })

    const tokens = this.generateTokens(user)
    await this.saveRefreshToken(user.id, tokens.refreshToken)
    return tokens
  }

  // ── Logout ────────────────────────────────────────────
  async logout(refreshToken: string) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    })
  }

  // ── 2FA Setup ─────────────────────────────────────────
  async setupTwoFactor(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const secret = speakeasy.generateSecret({ name: `SVA Platform (${user.email})`, length: 20 })

    await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret.base32 } })

    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url!)
    return { secret: secret.base32, qrDataUrl }
  }

  async enableTwoFactor(userId: string, code: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (!user.twoFactorSecret) throw new Error('Setup 2FA first')

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    })
    if (!valid) throw new Error('Invalid code')

    await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } })
  }

  // ── Helpers ───────────────────────────────────────────
  private async saveRefreshToken(userId: string, token: string) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)
    await prisma.refreshToken.create({ data: { token, userId, expiresAt } })
  }

  private sanitizeUser(user: any) {
    const { passwordHash, twoFactorSecret, ...safe } = user
    return safe
  }

  private async audit(orgId: string, userId: string, action: string, resource: string, resourceId: string, ip?: string) {
    await prisma.auditLog.create({ data: { orgId, userId, action, resource, resourceId, ipAddress: ip } })
  }
}

export const authService = new AuthService()
