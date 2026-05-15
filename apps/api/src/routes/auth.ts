import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authService } from '../services/auth.service'

export async function authRoutes(app: FastifyInstance) {
  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    orgSlug: z.string().min(1),
  })

  const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
    orgName: z.string().min(2),
    orgSlug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
    timezone: z.string().optional(),
    currencies: z.array(z.string()).optional(),
  })

  // POST /auth/login
  app.post('/login', async (req, reply) => {
    const body = loginSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ success: false, errors: body.error.flatten() })

    try {
      const result = await authService.login(
        body.data.email,
        body.data.password,
        body.data.orgSlug,
        req.ip
      )
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      return reply.code(401).send({ success: false, message: err.message })
    }
  })

  // POST /auth/register
  app.post('/register', async (req, reply) => {
    const body = registerSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ success: false, errors: body.error.flatten() })

    try {
      const result = await authService.register(body.data)
      return reply.code(201).send({ success: true, data: result })
    } catch (err: any) {
      return reply.code(400).send({ success: false, message: err.message })
    }
  })

  // POST /auth/refresh
  app.post('/refresh', async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken: string }
    if (!refreshToken) return reply.code(400).send({ success: false, message: 'refreshToken required' })

    try {
      const tokens = await authService.refreshTokens(refreshToken)
      return reply.send({ success: true, data: tokens })
    } catch (err: any) {
      return reply.code(401).send({ success: false, message: err.message })
    }
  })

  // POST /auth/logout
  app.post('/logout', async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken: string }
    if (refreshToken) await authService.logout(refreshToken)
    return reply.send({ success: true })
  })

  // POST /auth/2fa/verify
  app.post('/2fa/verify', async (req, reply) => {
    const { userId, code } = req.body as { userId: string; code: string }
    try {
      const result = await authService.verifyTwoFactor(userId, code, req.ip)
      return reply.send({ success: true, data: result })
    } catch (err: any) {
      return reply.code(401).send({ success: false, message: err.message })
    }
  })

  // POST /auth/2fa/setup (protected)
  app.post('/2fa/setup', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const result = await authService.setupTwoFactor(req.user.sub)
    return reply.send({ success: true, data: result })
  })

  // POST /auth/2fa/enable (protected)
  app.post('/2fa/enable', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    const { code } = req.body as { code: string }
    try {
      await authService.enableTwoFactor(req.user.sub, code)
      return reply.send({ success: true, message: '2FA enabled successfully' })
    } catch (err: any) {
      return reply.code(400).send({ success: false, message: err.message })
    }
  })

  // GET /auth/me (protected)
  app.get('/me', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false })
    return reply.send({ success: true, data: req.user })
  })
}
