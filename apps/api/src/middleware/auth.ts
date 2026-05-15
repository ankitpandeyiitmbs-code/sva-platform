import type { FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import { env } from '../utils/env'
import type { JWTPayload } from '../lib/types'

const PUBLIC_ROUTES = [
  '/health',
  '/docs',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/webhooks/',
  '/api/v1/tiktok/callback',
]

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload
  }
}

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const isPublic = PUBLIC_ROUTES.some((route) => req.url.startsWith(route))
  if (isPublic) return

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ success: false, code: 'UNAUTHORIZED', message: 'Missing token' })
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JWTPayload
    req.user = payload
  } catch {
    return reply.code(401).send({ success: false, code: 'TOKEN_INVALID', message: 'Invalid or expired token' })
  }
}

export function requirePermission(permission: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      return reply.code(401).send({ success: false, code: 'UNAUTHORIZED', message: 'Not authenticated' })
    }
    if (!req.user.permissions.includes(permission as any)) {
      return reply.code(403).send({ success: false, code: 'FORBIDDEN', message: 'Insufficient permissions' })
    }
  }
}
